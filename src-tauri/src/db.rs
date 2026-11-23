use rusqlite::{Connection, Result, params};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

pub struct Database {
    conn: Connection,
}

impl Database {
    // Ініціалізація бази flins.db із суворими правами доступу.
    // Фаза 7: файл шифрується SQLCipher (за ключем з OS-сховища).
    // «Скопіювати flins.db і відкрити sqlite-browser» більше не працює: без ключа файл — шум.
    pub fn new() -> Result<Self> {
        let app_dir = get_flins_data_dir().unwrap_or_else(|| PathBuf::from("."));
        fs::create_dir_all(&app_dir).ok();

        // Захист директорії: права rwx------ (0700) тільки для поточного користувача
        #[cfg(unix)]
        {
            if let Ok(metadata) = fs::metadata(&app_dir) {
                let mut perm = metadata.permissions();
                perm.set_mode(0o700);
                let _ = fs::set_permissions(&app_dir, perm);
            }
        }

        let db_path = app_dir.join("flins.db");
        let existed = db_path.exists();
        let plaintext = existed && file_is_plaintext_sqlite(&db_path);

        let key_entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(keyring_err)?;
        let stored_key: Option<String> = match key_entry.get_password() {
            Ok(k) if !k.trim().is_empty() => Some(k),
            Ok(_) => None,
            Err(keyring::Error::NoEntry) => None,
            Err(e) => return Err(keyring_err(e)),
        };

        // Файл уже шифрований, але ключа в сховищі немає (напр. сховище витерто):
        // генерувати новий ключ НЕ можна — дані залишилися б заблоковані назавжди.
        // Просимо бекап.
        if stored_key.is_none() && existed && !plaintext {
            return Err(rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_ERROR),
                Some(format!(
                    "flins.db зашифрований, але ключ не знайдено в системному сховищі ({KEYRING_SERVICE}/{KEYRING_USER}). Відновіть ключ або використайте JSON-бекап."
                )),
            ));
        }

        // Ключ зберігаємо і ПЕРЕВІРЯЄМО ЙОГО ПОСТІЙНІСТЬ ДО будь-яких змін даних.
        // Урок 2026-11-23: без feature-флагів keyring мовчки використовує mock-сховище:
        // set_password «працює», але ключ вмирає з процесом. Теперread-back обовʼязковий.
        let key = match stored_key {
            Some(k) => k,
            None => {
                let k = random_key_hex();
                key_entry.set_password(&k).map_err(keyring_err)?;
                match key_entry.get_password() {
                    Ok(read_back) if read_back == k => k,
                    Ok(_) => {
                        let _ = key_entry.delete_credential();
                        return Err(rusqlite::Error::SqliteFailure(
                            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_ERROR),
                            Some("Сховище ключів повернуло інший ключ при перевірці. Дані не чіпані.".into()),
                        ));
                    }
                    Err(e) => {
                        let _ = key_entry.delete_credential();
                        return Err(rusqlite::Error::SqliteFailure(
                            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_ERROR),
                            Some(format!(
                                "Сховище ключів не зміг зберегти ключ БД ({e}). Дані не чіпані."
                            )),
                        ));
                    }
                }
            }
        };

        let conn = if plaintext {
            // Міграція баз із 0.x. Емпірично (тест export_encrypts_plaintext_and_requires_key):
            // «PRAGMA rekey» на plaintext-файлі в SQLCipher 4.5 НЕ переписує диск — тому
            // official-шлях: ATTACH шифрованої копії + sqlcipher_export + ротація файлів.
            let conn = Connection::open(&db_path)?;
            conn.query_row("SELECT count(*) FROM sqlite_master", [], |r| {
                r.get::<_, i64>(0)
            })?;

            let bak = app_dir.join("flins.pre-encrypt.bak");
            let copied = fs::copy(&db_path, &bak).is_ok();
            let tmp = app_dir.join("flins.encrypted.tmp");
            let _ = fs::remove_file(&tmp);
            if let Err(e) = export_to_encrypted(&conn, &tmp, &key) {
                return Err(rusqlite::Error::SqliteFailure(
                    rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_ERROR),
                    Some(format!(
                        "Не вдалося зашифрувати базу: {e}. Оригіл недоторканий, копія: {:?}",
                        bak
                    )),
                ));
            }
            drop(conn);

            // ротація: зашифрований tmp стає flins.db
            fs::rename(&tmp, &db_path).map_err(|e| {
                rusqlite::Error::SqliteFailure(
                    rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_ERROR),
                    Some(format!(
                        "Не вдалося замінити flins.db на зашифровану копію: {e}. Копія: {:?}",
                        tmp
                    )),
                )
            })?;
            let _ = fs::remove_file(app_dir.join("flins.db-wal"));
            let _ = fs::remove_file(app_dir.join("flins.db-shm"));

            // фінальна перевірка: відкривається з ключем, читається схема — тоді мінус бекап
            let conn = Connection::open(&db_path)?;
            apply_key(&conn, &key)?;
            conn.query_row("SELECT count(*) FROM sqlite_master", [], |r| {
                r.get::<_, i64>(0)
            })?;
            if copied {
                let _ = fs::remove_file(&bak);
            }
            conn
        } else {
            let conn = Connection::open(&db_path)?;
            apply_key(&conn, &key)?;
            // Перевірка, що ключ валідний — інакше «file is not a database» вилізе вже тут
            conn.query_row("SELECT count(*) FROM sqlite_master", [], |r| {
                r.get::<_, i64>(0)
            })?;
            conn
        };

        // Захист файлу бази: права rw------- (0600) тільки для власника
        #[cfg(unix)]
        {
            if let Ok(metadata) = fs::metadata(&db_path) {
                let mut perm = metadata.permissions();
                perm.set_mode(0o600);
                let _ = fs::set_permissions(&db_path, perm);
            }
        }

        // Версія схеми БД: PRAGMA user_version = 0 означає повністю нову (порожню) базу.
        // Існуючі бази (0.1.0) мають user_version = 0, але вже містять таблиці, тому
        // база версії 0 створюється через CREATE TABLE IF NOT EXISTS — це безпечно.
        let schema_version: i64 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap_or(0);

        if schema_version < SCHEMA_VERSION {
            migrate(&conn, schema_version)?;
        }

        Ok(Database { conn })
    }

    // --- МЕТОДИ ДЛЯ ЩОДЕННИКА ---
    pub fn save_journal_entry(
        &self,
        date_key: &str,
        pages_json: &str,
        metadata_json: &str,
        remark: &str,
    ) -> Result<()> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        self.conn.execute(
            "INSERT INTO journal_entries (date_key, pages_json, metadata_json, remark, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(date_key) DO UPDATE SET
                pages_json = excluded.pages_json,
                metadata_json = excluded.metadata_json,
                remark = excluded.remark,
                updated_at = excluded.updated_at;",
            params![date_key, pages_json, metadata_json, remark, now],
        )?;
        Ok(())
    }

    pub fn load_all_journal_entries(&self) -> Result<Vec<(String, String, String, String)>> {
        let mut stmt = self.conn.prepare(
            "SELECT date_key, pages_json, metadata_json, COALESCE(remark, '') FROM journal_entries",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })?;

        let mut entries = Vec::new();
        for row in rows {
            entries.push(row?);
        }
        Ok(entries)
    }

    // Отримання записів за останні дні (до вибраної дати) для контексту пам'яті ШІ
    pub fn load_recent_journal_entries(
        &self,
        before_date: &str,
        limit: usize,
    ) -> Result<Vec<(String, String, String, String)>> {
        let mut stmt = self.conn.prepare(
            "SELECT date_key, pages_json, metadata_json, COALESCE(remark, '')
             FROM journal_entries
             WHERE date_key < ?1 AND length(trim(pages_json)) > 20
             ORDER BY date_key DESC
             LIMIT ?2",
        )?;

        let rows = stmt.query_map(params![before_date, limit as i64], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })?;

        let mut entries = Vec::new();
        for row in rows {
            entries.push(row?);
        }
        Ok(entries)
    }

    // --- МЕТОДИ ДЛЯ НОТАТОК ---
    pub fn save_note(
        &self,
        id: &str,
        title: &str,
        folder_id: Option<&str>,
        pages_json: &str,
        active_page_index: i32,
    ) -> Result<()> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        self.conn.execute(
            "INSERT INTO notes (id, title, folder_id, pages_json, active_page_index, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                folder_id = excluded.folder_id,
                pages_json = excluded.pages_json,
                active_page_index = excluded.active_page_index,
                updated_at = excluded.updated_at;",
            params![id, title, folder_id, pages_json, active_page_index, now],
        )?;
        Ok(())
    }

    pub fn delete_note(&self, id: &str) -> Result<()> {
        self.conn
            .execute("DELETE FROM notes WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn load_all_notes(&self) -> Result<Vec<(String, String, Option<String>, String, i32)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, title, folder_id, pages_json, active_page_index FROM notes")?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        })?;

        let mut notes = Vec::new();
        for row in rows {
            notes.push(row?);
        }
        Ok(notes)
    }

    // --- МЕТОДИ ДЛЯ ПАПОК ---
    pub fn save_folders(&self, folders_json: &str) -> Result<()> {
        let folders: Vec<serde_json::Value> =
            serde_json::from_str(folders_json).unwrap_or_default();
        self.conn.execute("DELETE FROM folders", [])?;

        for f in folders {
            if let (Some(id), Some(name)) = (
                f.get("id").and_then(|v| v.as_str()),
                f.get("name").and_then(|v| v.as_str()),
            ) {
                self.conn.execute(
                    "INSERT INTO folders (id, name) VALUES (?1, ?2)",
                    params![id, name],
                )?;
            }
        }
        Ok(())
    }

    pub fn load_all_folders(&self) -> Result<Vec<(String, String)>> {
        let mut stmt = self.conn.prepare("SELECT id, name FROM folders")?;
        let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
        let mut folders = Vec::new();
        for row in rows {
            folders.push(row?);
        }
        Ok(folders)
    }

    // --- НАЛАШТУВАННЯ ---
    pub fn save_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO app_settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn load_setting(&self, key: &str) -> Result<Option<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT value FROM app_settings WHERE key = ?1")?;
        let mut rows = stmt.query_map(params![key], |row| row.get(0))?;
        if let Some(row) = rows.next() {
            return Ok(Some(row?));
        }
        Ok(None)
    }

    pub fn delete_setting(&self, key: &str) -> Result<()> {
        self.conn
            .execute("DELETE FROM app_settings WHERE key = ?1", params![key])?;
        Ok(())
    }

    // 7.8 — авто-бекап: не більше одного на старт застосунку. Копія — той самий
    // шифротекст (жодного plaintext-вмісту). Тримаємо останні 7 копій.
    pub fn backup_once(&self) {
        let Some(app_dir) = get_flins_data_dir() else {
            return;
        };
        let db_path = app_dir.join("flins.db");
        if !db_path.exists() {
            return;
        }

        let bdir = app_dir.join("backups");
        if fs::create_dir_all(&bdir).is_err() {
            return;
        }

        // unix-seconds у імені: лексикографічне сортування = хронологія
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let dst = bdir.join(format!("flins-{now}.db"));
        if dst.exists() {
            return; // уже бекапились у цю секунду
        }

        // WAL-хвіст має потрапити в копію — інакше останні транзакції загубляться
        let _ = self.conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");

        if fs::copy(&db_path, &dst).is_err() {
            return;
        }
        #[cfg(unix)]
        {
            if let Ok(metadata) = fs::metadata(&dst) {
                let mut perm = metadata.permissions();
                perm.set_mode(0o600);
                let _ = fs::set_permissions(&dst, perm);
            }
        }
        prune_old_backups(&bdir);
    }
}

// --- ФАЗА 7: ШИФРУВАННЯ БД (SQLCipher + OS Keychain) ---
const KEYRING_SERVICE: &str = "com.flins.app";
const KEYRING_USER: &str = "flins-db-key";

fn keyring_err(e: keyring::Error) -> rusqlite::Error {
    rusqlite::Error::SqliteFailure(
        rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_ERROR),
        Some(format!("Системне сховище ключів недоступне: {e}")),
    )
}

// Plaintext-SQLite починається з магічного рядка «SQLite format 3\0».
// У зашифрованого SQLCipher-файла заголовок — псевдовипадкові байти.
fn file_is_plaintext_sqlite(path: &std::path::Path) -> bool {
    let mut buf = [0u8; 16];
    match fs::File::open(path).and_then(|mut f| f.read_exact(&mut buf)) {
        Ok(()) => &buf[..15] == b"SQLite format 3",
        Err(_) => false,
    }
}

// Новий 256-бітний ключ (64 hex-символи), CSPRNG. Використовується як passphrase —
// SQLCipher сам простягає його KDF'ом до обертового ключа.
fn random_key_hex() -> String {
    use rand_core::RngCore;
    let mut bytes = [0u8; 32];
    rand_core::OsRng.fill_bytes(&mut bytes);
    let mut s = String::with_capacity(64);
    for b in bytes.iter() {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

fn apply_key(conn: &Connection, key: &str) -> Result<()> {
    conn.pragma_update(None, "key", key)
}

// 7.8 — лишаємо останні 7 бекапів (імена unix-secs сортуються хронологічно)
fn prune_old_backups(bdir: &Path) {
    const KEEP: usize = 7;
    let Ok(entries) = fs::read_dir(bdir) else {
        return;
    };
    let mut files: Vec<PathBuf> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.is_file())
        .collect();
    if files.len() <= KEEP {
        return;
    }
    files.sort();
    let excess = files.len() - KEEP;
    for f in files.iter().take(excess) {
        let _ = fs::remove_file(f);
    }
}

// Міграція plaintext-бази в шифровану: ATTACH нового файлу з ключем і поїзійний
// експорт сторінок. Шлях і ключ — власні константи/hex, але екрануємо дужки все одно.
fn export_to_encrypted(conn: &Connection, tmp_path: &std::path::Path, key: &str) -> Result<()> {
    let esc = |s: &str| s.replace('\'', "''");
    conn.execute_batch(&format!(
        "ATTACH DATABASE '{}' AS encrypted KEY '{}';",
        esc(&tmp_path.display().to_string()),
        esc(key)
    ))?;
    // sqlcipher_export повертає NULL (важливий сам факт успіху) — не чіпаємо тип
    conn.query_row("SELECT sqlcipher_export('encrypted')", [], |_r| Ok(()))?;
    conn.execute_batch("DETACH DATABASE encrypted;")?;
    Ok(())
}

// Поточна версія схеми БД. Збільшуй на 1 при КОЖНІЙ зміні структури таблиць
// (нова колонка, нова таблиця, індекс) і додавай відповідну гілку в migrate().
// Ніколи не зменшуй і не перейменовуй already-випущені версії — користувачі
// оновлюватимуть базу з-під своїх даних і не повинні її втрачати.
const SCHEMA_VERSION: i64 = 1;

// Міграції: послідовні сходинки versions 0 -> 1 -> 2 -> ...
// Кожна гілка огорнута в транзакцію: якщо щось піде не так, база лишається
// на попередній версії, а не в напівзруйнованому стані.
fn migrate(conn: &Connection, mut version: i64) -> Result<()> {
    if version < 1 {
        conn.execute_batch(
            "
            BEGIN;
            CREATE TABLE IF NOT EXISTS journal_entries (
                date_key TEXT PRIMARY KEY,
                pages_json TEXT NOT NULL,
                metadata_json TEXT NOT NULL,
                remark TEXT,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                folder_id TEXT,
                pages_json TEXT NOT NULL,
                active_page_index INTEGER NOT NULL DEFAULT 0,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            PRAGMA user_version = 1;
            COMMIT;
            ",
        )?;
        version = 1;
    }

    // Шаблон для майбутніх змін (наприклад, додати колонку tag в notes):
    // if version < 2 {
    //     conn.execute_batch("BEGIN; ALTER TABLE notes ADD COLUMN tags TEXT; PRAGMA user_version = 2; COMMIT;")?;
    //     version = 2;
    // }

    // Захист від «база новіша за застосунок» (downgrade): дані не чіпаємо,
    // просто не даємо працювати зі схемою, яку не розуміємо.
    if version > SCHEMA_VERSION {
        return Err(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_ERROR),
            Some(format!(
                "Схема БД (v{}) новіша за застосунок (v{}). Оновіть Flins.",
                version, SCHEMA_VERSION
            )),
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tables(conn: &Connection) -> Vec<String> {
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap();
        stmt.query_map([], |r| r.get::<_, String>(0))
            .unwrap()
            .filter_map(Result::ok)
            .collect()
    }

    fn user_version(conn: &Connection) -> i64 {
        conn.query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap()
    }

    #[test]
    fn fresh_db_migrates_to_current_schema() {
        let conn = Connection::open_in_memory().unwrap();
        assert_eq!(user_version(&conn), 0);
        migrate(&conn, 0).unwrap();
        assert_eq!(user_version(&conn), SCHEMA_VERSION);
        let t = tables(&conn);
        for expected in ["app_settings", "folders", "journal_entries", "notes"] {
            assert!(
                t.iter().any(|x| x == expected),
                "missing table {}",
                expected
            );
        }
    }

    #[test]
    fn migrate_is_idempotent_on_existing_v1_db() {
        // Симуляція бази користувача версії 0.1.0: таблиці вже є, user_version = 0
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE journal_entries (date_key TEXT PRIMARY KEY);")
            .unwrap();
        migrate(&conn, 0).unwrap();
        assert_eq!(user_version(&conn), SCHEMA_VERSION);
    }

    #[test]
    fn keeps_only_seven_newest_backups() {
        let dir = std::env::temp_dir().join(format!("flins-bak-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let bdir = dir.join("backups");
        fs::create_dir_all(&bdir).unwrap();
        for i in 0..9 {
            fs::write(bdir.join(format!("flins-{i}.db")), b"x").unwrap();
        }
        prune_old_backups(&bdir);
        let kept: Vec<_> = fs::read_dir(&bdir).unwrap().flatten().collect();
        assert_eq!(kept.len(), 7);
        let names: Vec<String> = kept
            .iter()
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
        assert!(!names.contains(&"flins-0.db".to_string()));
        assert!(!names.contains(&"flins-1.db".to_string()));
        assert!(names.contains(&"flins-8.db".to_string()));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn refuses_downgrade() {
        let conn = Connection::open_in_memory().unwrap();
        let err = migrate(&conn, SCHEMA_VERSION + 1);
        assert!(err.is_err());
    }

    #[test]
    fn random_key_is_64_hex() {
        let k = random_key_hex();
        assert_eq!(k.len(), 64);
        assert!(k.chars().all(|c| c.is_ascii_hexdigit()));
    }

    // Діагностика: чи зібраний rusqlite саме з SQLCipher (у plain SQLite цей pragma порожній)
    #[test]
    fn build_actually_uses_sqlcipher() {
        let conn = Connection::open_in_memory().unwrap();
        let v: Option<String> = conn
            .query_row("PRAGMA cipher_version", [], |r| r.get(0))
            .ok();
        assert!(
            v.is_some(),
            "PRAGMA cipher_version порожній — rusqlite зібраний БЕЗ SQLCipher, шифрування не працює!"
        );
    }

    // Фаза 7:plaintext → export → шифрований файл; чужий ключ не пускає, свій — читає дані.
    // Тест не чіпає keyring (тільки низькорівневі хелпери), тож безпечний у CI.
    #[test]
    fn export_encrypts_plaintext_and_requires_key() {
        let dir = std::env::temp_dir().join(format!("flins-crypt-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let p = dir.join("t.db");
        let enc = dir.join("t.enc.tmp");

        // Без PRAGMA key SQLCipher поведінкою як звичайний SQLite — plaintext-файл
        {
            let conn = Connection::open(&p).unwrap();
            conn.execute_batch("CREATE TABLE t(x); INSERT INTO t VALUES (42);")
                .unwrap();

            // Те саме, що Database::new робить під час міграції 0.x
            export_to_encrypted(&conn, &enc, "test-key-for-roundtrip").unwrap();
        }
        assert!(
            !file_is_plaintext_sqlite(&enc),
            "export must no longer be plaintext"
        );

        // Невірний ключ — копія не читається
        {
            let conn = Connection::open(&enc).unwrap();
            apply_key(&conn, "wrong-key").unwrap();
            let r = conn.query_row("SELECT count(*) FROM t", [], |x| x.get::<_, i64>(0));
            assert!(r.is_err(), "wrong key must not unlock the export");
        }

        // Вірний ключ — дані цілісні
        {
            let conn = Connection::open(&enc).unwrap();
            apply_key(&conn, "test-key-for-roundtrip").unwrap();
            let v: i64 = conn.query_row("SELECT x FROM t", [], |r| r.get(0)).unwrap();
            assert_eq!(v, 42);
        }
        let _ = fs::remove_dir_all(&dir);
    }
}
// - macOS: ~/Library/Application Support/FlinsData (100% сумісність з вашою поточною базою!)
// - Windows: %APPDATA%\FlinsData (C:\Users\<Name>\AppData\Roaming\FlinsData)
// - Linux: ~/.local/share/FlinsData
fn get_flins_data_dir() -> Option<PathBuf> {
    dirs_next::data_dir().map(|path| path.join("FlinsData"))
}
