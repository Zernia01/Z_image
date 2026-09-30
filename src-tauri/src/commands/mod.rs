use crate::{
    animation, cache, display, filesystem, metadata,
    models::{
        AnimationInfo, CacheStats, DropResult, FileBatchResult, ImageEntry, ImageMetadata,
        MoveResult,
    },
    platform, thumbnail,
};
#[tauri::command]
pub async fn scan_folder(path: String, generation: u64) -> Result<Vec<ImageEntry>, String> {
    let _ = generation;
    tauri::async_runtime::spawn_blocking(move || filesystem::scan(&path))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn get_thumbnail(path: String, size: u32) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || thumbnail::create(&path, size.clamp(64, 1024)))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn get_cached_thumbnail(path: String, size: u32) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || thumbnail::lookup(&path, size.clamp(64, 1024)))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn get_display_image(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || display::prepare(&path))
        .await
        .map_err(|error| error.to_string())?
}
#[tauri::command]
pub async fn decode_animation(path: String) -> Result<Option<AnimationInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || animation::decode(&path))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn read_metadata(path: String) -> Result<ImageMetadata, String> {
    tauri::async_runtime::spawn_blocking(move || metadata::read(&path))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn cache_stats() -> Result<CacheStats, String> {
    cache::stats()
}
#[tauri::command]
pub async fn clear_thumbnail_cache() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(cache::clear)
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn move_files(
    paths: Vec<String>,
    destination: String,
) -> Result<FileBatchResult<MoveResult>, String> {
    Ok(
        tauri::async_runtime::spawn_blocking(move || filesystem::move_files(paths, destination))
            .await
            .map_err(|e| e.to_string())?,
    )
}
#[tauri::command]
pub async fn move_files_to_trash(paths: Vec<String>) -> Result<FileBatchResult<String>, String> {
    Ok(
        tauri::async_runtime::spawn_blocking(move || filesystem::move_to_trash(paths))
            .await
            .map_err(|e| e.to_string())?,
    )
}
#[tauri::command]
pub async fn resolve_dropped_paths(paths: Vec<String>) -> Result<DropResult, String> {
    Ok(
        tauri::async_runtime::spawn_blocking(move || filesystem::resolve_dropped_paths(paths))
            .await
            .map_err(|e| e.to_string())?,
    )
}
#[tauri::command]
pub async fn open_default_apps_settings() -> Result<(), String> {
    platform::open_default_apps_settings()
}

#[tauri::command]
pub fn get_launch_paths() -> Vec<String> {
    std::env::args_os()
        .skip(1)
        .map(std::path::PathBuf::from)
        .filter(|path| path.exists())
        .map(|path| path.to_string_lossy().into_owned())
        .collect()
}

#[tauri::command]
pub fn set_native_fullscreen(
    window: tauri::WebviewWindow,
    enabled: bool,
) -> Result<(), String> {
    platform::set_native_fullscreen(&window, enabled)
}
