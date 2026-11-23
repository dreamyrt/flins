mod db;
use db::Database;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
// Manager потрібен лише для get_webview_window у cfg(windows) блоці нижче.
#[allow(unused_imports)]
use tauri::Manager;

struct AppState {
    db: Mutex<Database>,
}

// --- ІКОНКА DOCK (МАЄ ЕФЕКТ ЛИШЕ НА MACOS) ---
#[tauri::command]
#[allow(deprecated)]
#[allow(unused_variables)]
fn set_dock_icon(image_bytes: Vec<u8>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use cocoa::appkit::{NSApp, NSApplication, NSImage};
        use cocoa::base::nil;
        use cocoa::foundation::NSData;

        unsafe {
            let app = NSApp();
            if app == nil {
                return Err("NSApp не знайдено".into());
            }

            let data = NSData::dataWithBytes_length_(
                nil,
                image_bytes.as_ptr() as *const std::ffi::c_void,
                image_bytes.len() as cocoa::foundation::NSUInteger,
            );

            if data == nil {
                return Err("Не вдалося створити NSData".into());
            }

            let ns_image = NSImage::initWithData_(NSImage::alloc(nil), data);
            if ns_image == nil {
                return Err("Не вдалося створити NSImage".into());
            }

            app.setApplicationIconImage_(ns_image);
        }
    }
    Ok(())
}

// --- КЕРУВАННЯ ВІКНОМ ДЛЯ WINDOWS (ЗГОРНУТИ, РОЗГОРНУТИ, ЗАКРИТИ) ---
#[tauri::command]
fn window_minimize(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn window_toggle_maximize(window: tauri::Window) {
    if let Ok(is_max) = window.is_maximized() {
        if is_max {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

#[tauri::command]
fn window_close(window: tauri::Window) {
    let _ = window.close();
}

// --- КОМАНДИ SQLITE ---

#[tauri::command]
fn db_save_journal_entry(
    state: tauri::State<AppState>,
    date_key: String,
    pages_json: String,
    metadata_json: String,
    remark: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.save_journal_entry(&date_key, &pages_json, &metadata_json, &remark)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn db_load_journal_entries(
    state: tauri::State<AppState>,
) -> Result<Vec<(String, String, String, String)>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.load_all_journal_entries().map_err(|e| e.to_string())
}

#[tauri::command]
fn db_load_recent_journal_entries(
    state: tauri::State<AppState>,
    before_date: String,
    limit: usize,
) -> Result<Vec<(String, String, String, String)>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.load_recent_journal_entries(&before_date, limit)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn db_save_note(
    state: tauri::State<AppState>,
    id: String,
    title: String,
    folder_id: Option<String>,
    pages_json: String,
    active_page_index: i32,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.save_note(
        &id,
        &title,
        folder_id.as_deref(),
        &pages_json,
        active_page_index,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn db_delete_note(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_note(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_load_notes(
    state: tauri::State<AppState>,
) -> Result<Vec<(String, String, Option<String>, String, i32)>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.load_all_notes().map_err(|e| e.to_string())
}

#[tauri::command]
fn db_save_folders(state: tauri::State<AppState>, folders_json: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.save_folders(&folders_json).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_load_folders(state: tauri::State<AppState>) -> Result<Vec<(String, String)>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.load_all_folders().map_err(|e| e.to_string())
}

#[tauri::command]
fn db_save_setting(
    state: tauri::State<AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.save_setting(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_load_setting(state: tauri::State<AppState>, key: String) -> Result<Option<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.load_setting(&key).map_err(|e| e.to_string())
}

// --- ПАРОЛЬ ЗАСТОСУНКУ (6.3: UI-lock. Данні захищає диск, не цей пароль) ---
const PW_KEY: &str = "app_password_hash";
// 6.4 — recovery-код: у БД зберігається лише його argon2-хеш, сам код показується один раз
const RECOVERY_KEY: &str = "app_recovery_hash";

fn hash_password(password: &str) -> Result<String, String> {
    use argon2::password_hash::{PasswordHasher, SaltString};
    let salt = SaltString::generate(&mut rand_core::OsRng);
    argon2::Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|phc| phc.to_string())
        .map_err(|e| e.to_string())
}

fn verify_password(password: &str, phc_hash: &str) -> Result<bool, String> {
    use argon2::password_hash::{PasswordHash, PasswordVerifier};
    let parsed = PasswordHash::new(phc_hash).map_err(|e| e.to_string())?;
    // Argon2 перевірка сама const-time (timing-safe)
    Ok(argon2::Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

fn check_pw_len(password: &str) -> Result<(), String> {
    if password.trim().chars().count() < 4 {
        return Err("Пароль занадто короткий (мін. 4 символи)".into());
    }
    Ok(())
}

// Алфавіт 32 символи (без 0/O/1/I — візуально неоднозначні). 2^32 ділиться на 32 → без ухилення
fn generate_recovery_code() -> String {
    use rand_core::RngCore;
    const ALPHA: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut out = String::from("FLINS-");
    for i in 0..12u32 {
        if i > 0 && i % 4 == 0 {
            out.push('-');
        }
        let idx = rand_core::OsRng.next_u32() % 32;
        out.push(ALPHA[idx as usize] as char);
    }
    out
}

// Новий recovery-код + його argon2-хеш (хеш — тільки в БД, код — один раз на екран)
fn make_recovery() -> Result<(String, String), String> {
    let code = generate_recovery_code();
    let hash = hash_password(&code)?;
    Ok((code, hash))
}

fn normalize_recovery_code(raw: &str) -> String {
    raw.trim().to_uppercase().replace(' ', "")
}

#[tauri::command]
fn app_password_exists(state: tauri::State<AppState>) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    Ok(db
        .load_setting(PW_KEY)
        .map_err(|e| e.to_string())?
        .is_some())
}

#[tauri::command]
fn set_app_password(state: tauri::State<AppState>, password: String) -> Result<String, String> {
    check_pw_len(&password)?;
    let phc = hash_password(&password)?;
    let (code, recovery_hash) = make_recovery()?;
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.save_setting(PW_KEY, &phc).map_err(|e| e.to_string())?;
    db.save_setting(RECOVERY_KEY, &recovery_hash)
        .map_err(|e| e.to_string())?;
    // код показується один раз — більше нікуди не пишемо
    Ok(code)
}

#[tauri::command]
fn unlock_app(state: tauri::State<AppState>, password: String) -> Result<bool, String> {
    let stored = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.load_setting(PW_KEY).map_err(|e| e.to_string())?
    };
    match stored {
        Some(phc) => verify_password(&password, &phc),
        None => Ok(true),
    }
}

#[tauri::command]
fn change_app_password(
    state: tauri::State<AppState>,
    old_password: String,
    new_password: String,
) -> Result<Option<String>, String> {
    let stored = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.load_setting(PW_KEY).map_err(|e| e.to_string())?
    };
    let Some(phc) = stored else {
        return Err("Пароль не встановлено".into());
    };
    if !verify_password(&old_password, &phc)? {
        return Ok(None);
    }
    check_pw_len(&new_password)?;
    let new_phc = hash_password(&new_password)?;
    // 6.4.5 — при зміні пароля старий код «згорає», генеруємо новий (один раз на екран)
    let (code, recovery_hash) = make_recovery()?;
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.save_setting(PW_KEY, &new_phc)
        .map_err(|e| e.to_string())?;
    db.save_setting(RECOVERY_KEY, &recovery_hash)
        .map_err(|e| e.to_string())?;
    Ok(Some(code))
}

#[tauri::command]
fn remove_app_password(state: tauri::State<AppState>, password: String) -> Result<bool, String> {
    let stored = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.load_setting(PW_KEY).map_err(|e| e.to_string())?
    };
    let Some(phc) = stored else { return Ok(true) };
    if !verify_password(&password, &phc)? {
        return Ok(false);
    }
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_setting(PW_KEY).map_err(|e| e.to_string())?;
    // recovery-код без пароля безсенсовний — зрізаємо разом
    db.delete_setting(RECOVERY_KEY).map_err(|e| e.to_string())?;
    Ok(true)
}

// 6.4.3 — flow «Забули пароль?»: recovery-код → новий пароль → новий код (ротація)
#[tauri::command]
fn reset_password_with_recovery(
    state: tauri::State<AppState>,
    recovery_code: String,
    new_password: String,
) -> Result<Option<String>, String> {
    let stored_hash = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.load_setting(RECOVERY_KEY).map_err(|e| e.to_string())?
    };
    let Some(hash) = stored_hash else {
        return Err("Recovery-код не збережено (старий пароль без коду)".into());
    };
    let normalized = normalize_recovery_code(&recovery_code);
    if normalized.is_empty() || !verify_password(&normalized, &hash)? {
        return Ok(None);
    }
    check_pw_len(&new_password)?;
    let phc = hash_password(&new_password)?;
    let (code, new_hash) = make_recovery()?;
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.save_setting(PW_KEY, &phc).map_err(|e| e.to_string())?;
    db.save_setting(RECOVERY_KEY, &new_hash)
        .map_err(|e| e.to_string())?;
    Ok(Some(code))
}

#[tauri::command]
fn app_recovery_exists(state: tauri::State<AppState>) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    Ok(db
        .load_setting(RECOVERY_KEY)
        .map_err(|e| e.to_string())?
        .is_some())
}

// Збереження коду у .txt через нативний діалог (rfd) — без нових плагінів кліпборду/fs
#[tauri::command]
fn save_recovery_file(content: String) -> Result<bool, String> {
    let path = rfd::FileDialog::new()
        .set_file_name("flins-recovery-code.txt")
        .add_filter("Text", &["txt"])
        .save_file();
    match path {
        Some(p) => {
            fs::write(&p, content).map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false), // юзер скасував діалог
    }
}

// --- ДЗЕРКАЛЮВАННЯ У ФІЗИЧНУ ПАПКУ ---
#[tauri::command]
fn sync_to_vault_folder(
    vault_dir: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    let base = PathBuf::from(&vault_dir);
    if !base.is_dir() {
        return Err("Вказана директорія сховища не існує".into());
    }

    // Захист від Path Traversal: забороняємо .. та абсолютні шляхи
    let rel = PathBuf::from(&relative_path);
    for component in rel.components() {
        match component {
            std::path::Component::ParentDir => {
                return Err("Спроба Path Traversal (.. заборонено)".into());
            }
            std::path::Component::RootDir | std::path::Component::Prefix(_) => {
                return Err("Шлях має бути виключно відносним".into());
            }
            _ => {}
        }
    }

    let full_path = base.join(rel);

    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::write(&full_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

// --- КРОСПЛАТФОРМЕННИЙ ВИБІР ПАПКИ (RFD) ---
#[tauri::command]
fn pick_vault_folder() -> Result<Option<String>, String> {
    let folder = rfd::FileDialog::new()
        .set_title("Оберіть папку для фізичного сховища Flins")
        .pick_folder();

    Ok(folder.map(|p| p.to_string_lossy().to_string()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = Database::new().expect("Не вдалося ініціалізувати SQLite базу даних");

    // 7.8 — щоразовий авто-бекап шифрованої бази ДО будь-яких дій сесії:
    // копія — той самий шифротекст, у триманні останні 7 копій у FlinsData/backups/
    db.backup_once();

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let _ = &app; // використовується лише у cfg(windows) гілці нижче
            // На Windows знімаємо стандартну системну рамку для наших затишних кнопок
            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_decorations(false);
                }
            }
            Ok(())
        })
        .manage(AppState { db: Mutex::new(db) })
        .invoke_handler(tauri::generate_handler![
            set_dock_icon,
            window_minimize,
            window_toggle_maximize,
            window_close,
            db_save_journal_entry,
            db_load_journal_entries,
            db_load_recent_journal_entries,
            db_save_note,
            db_delete_note,
            db_load_notes,
            db_save_folders,
            db_load_folders,
            db_save_setting,
            db_load_setting,
            app_password_exists,
            set_app_password,
            unlock_app,
            change_app_password,
            remove_app_password,
            reset_password_with_recovery,
            app_recovery_exists,
            save_recovery_file,
            sync_to_vault_folder,
            pick_vault_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
