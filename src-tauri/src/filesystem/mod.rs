use crate::{image::is_supported, models::{DropResult, FileBatchResult, ImageEntry, MoveResult}};
use std::{fs, path::{Path, PathBuf}, time::UNIX_EPOCH};

pub fn scan(path: &str) -> Result<Vec<ImageEntry>, String> {
    let directory = Path::new(path);
    if !directory.is_dir() { return Err("선택한 경로가 폴더가 아닙니다.".into()); }
    let mut entries = Vec::new();
    for item in fs::read_dir(directory).map_err(|e| e.to_string())?.flatten() {
        let item_path = item.path();
        if !item_path.is_file() { continue; }
        let extension = item_path.extension().and_then(|x| x.to_str()).unwrap_or("").to_ascii_lowercase();
        if !is_supported(&extension) { continue; }
        if let Some(entry) = image_entry(&item_path, extension) { entries.push(entry); }
    }
    entries.sort_unstable_by(|a,b| natord::compare_ignore_case(&a.filename, &b.filename));
    Ok(entries)
}

pub fn resolve_dropped_paths(paths: Vec<String>) -> DropResult {
    if paths.len() == 1 {
        let path_text = paths[0].clone();
        let path = PathBuf::from(&path_text);
        if path.is_dir() { return DropResult { folder: Some(path_text), images: Vec::new(), active_path: None }; }
        if path.is_file() {
            let extension = path.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
            if is_supported(&extension) {
                let images = path.parent().and_then(|parent| parent.to_str()).and_then(|parent| scan(parent).ok()).unwrap_or_else(|| image_entry(&path, extension).into_iter().collect());
                return DropResult { folder: None, images, active_path: Some(path_text) };
            }
        }
    }
    let mut images = Vec::new();
    for path_text in paths {
        let path = PathBuf::from(&path_text);
        if path.is_dir() { return DropResult { folder: Some(path_text), images: Vec::new(), active_path: None }; }
        if !path.is_file() { continue; }
        let extension = path.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
        if !is_supported(&extension) { continue; }
        if let Some(entry) = image_entry(&path, extension) { images.push(entry); }
    }
    DropResult { folder: None, images, active_path: None }
}

fn image_entry(path: &Path, extension: String) -> Option<ImageEntry> {
    let metadata = fs::metadata(path).ok()?;
    let timestamp = |value: Result<std::time::SystemTime, std::io::Error>| value.ok().and_then(|v| v.duration_since(UNIX_EPOCH).ok()).map(|v| v.as_millis() as u64);
    let full_path = path.to_string_lossy().to_string();
    Some(ImageEntry {
        id: blake3::hash(full_path.as_bytes()).to_hex().to_string(), path: full_path,
        filename: path.file_name().and_then(|value| value.to_str()).unwrap_or("").to_string(), extension, size: metadata.len(),
        width: None, height: None, created_at: timestamp(metadata.created()), modified_at: timestamp(metadata.modified()), thumbnail_state: "idle",
    })
}

pub fn move_files(paths: Vec<String>, destination: String) -> FileBatchResult<MoveResult> {
    let destination = PathBuf::from(destination);
    let mut result = FileBatchResult { succeeded: Vec::new(), failed: Vec::new() };
    if !destination.is_dir() {
        result.failed.push("대상 폴더가 존재하지 않습니다.".into());
        return result;
    }
    for source_text in paths {
        let source = PathBuf::from(&source_text);
        let Some(filename) = source.file_name() else { result.failed.push(source_text); continue; };
        let target = available_path(&destination, filename);
        let moved = fs::rename(&source, &target).or_else(|_| {
            fs::copy(&source, &target)?;
            fs::remove_file(&source)
        });
        match moved {
            Ok(()) => result.succeeded.push(MoveResult { from: source_text, to: target.to_string_lossy().to_string() }),
            Err(error) => result.failed.push(format!("{}: {}", source.display(), error)),
        }
    }
    result
}

pub fn move_to_trash(paths: Vec<String>) -> FileBatchResult<String> {
    let mut result = FileBatchResult { succeeded: Vec::new(), failed: Vec::new() };
    for path in paths {
        match trash::delete(&path) {
            Ok(()) => result.succeeded.push(path),
            Err(error) => result.failed.push(format!("{path}: {error}")),
        }
    }
    result
}

fn available_path(directory: &Path, filename: &std::ffi::OsStr) -> PathBuf {
    let initial = directory.join(filename);
    if !initial.exists() { return initial; }
    let original = Path::new(filename);
    let stem = original.file_stem().and_then(|value| value.to_str()).unwrap_or("image");
    let extension = original.extension().and_then(|value| value.to_str());
    for index in 1..10_000 {
        let name = match extension { Some(ext) => format!("{stem} ({index}).{ext}"), None => format!("{stem} ({index})") };
        let candidate = directory.join(name);
        if !candidate.exists() { return candidate; }
    }
    directory.join(format!("{stem}-moved"))
}
