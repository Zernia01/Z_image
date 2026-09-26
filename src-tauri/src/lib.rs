mod cache; mod commands; mod filesystem; mod image; mod metadata; mod models; mod thumbnail;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init()).plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build()).plugin(tauri_plugin_process::init())
        .setup(|app| {
            if let (Some(window), Some(icon)) = (app.get_webview_window("main"), app.default_window_icon()) {
                window.set_icon(icon.clone())?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![commands::scan_folder, commands::get_thumbnail, commands::read_metadata, commands::cache_stats, commands::clear_thumbnail_cache, commands::move_files, commands::move_files_to_trash, commands::resolve_dropped_paths, commands::open_default_apps_settings, commands::get_launch_paths])
        .run(tauri::generate_context!()).expect("failed to run zernia image");
}
