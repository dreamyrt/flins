mod db;
use db::Database;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
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

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
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
            sync_to_vault_folder,
            pick_vault_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
