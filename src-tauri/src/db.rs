use rusqlite::{Connection, Result, params};
use std::fs;
use std::path::PathBuf;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

pub struct Database {
    conn: Connection,
}

impl Database {
    // Ініціалізація бази flins.db із суворими правами доступу
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
        let conn = Connection::open(&db_path)?;

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
    fn refuses_downgrade() {
        let conn = Connection::open_in_memory().unwrap();
        let err = migrate(&conn, SCHEMA_VERSION + 1);
        assert!(err.is_err());
    }
}
// - macOS: ~/Library/Application Support/FlinsData (100% сумісність з вашою поточною базою!)
// - Windows: %APPDATA%\FlinsData (C:\Users\<Name>\AppData\Roaming\FlinsData)
// - Linux: ~/.local/share/FlinsData
fn get_flins_data_dir() -> Option<PathBuf> {
    dirs_next::data_dir().map(|path| path.join("FlinsData"))
}
