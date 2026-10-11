mod animation;
mod avif;
mod cache;
mod commands;
mod display;
mod filesystem;
mod image;
mod metadata;
mod models;
mod platform;
mod thumbnail;

use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let paths: Vec<String> = args
                .into_iter()
                .skip(1)
                .filter(|path| std::path::Path::new(path).exists())
                .collect();
            if !paths.is_empty() {
                let _ = app.emit("open-paths", paths);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            if let Err(error) = platform::register_file_associations() {
                log::warn!("failed to register file associations: {error}");
            }
            if let (Some(window), Some(icon)) =
                (app.get_webview_window("main"), app.default_window_icon())
            {
                window.set_icon(icon.clone())?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_folder,
            commands::get_thumbnail,
            commands::get_cached_thumbnail,
            commands::get_display_image,
            commands::decode_animation,
            commands::read_metadata,
            commands::cache_stats,
            commands::clear_thumbnail_cache,
            commands::move_files,
            commands::move_files_to_trash,
            commands::resolve_dropped_paths,
            commands::open_default_apps_settings,
            commands::get_launch_paths,
            commands::set_native_fullscreen
        ])
        .run(tauri::generate_context!())
        .expect("failed to run zernia image");
}
