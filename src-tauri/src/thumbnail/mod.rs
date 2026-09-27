use directories::ProjectDirs;
use image::ImageFormat;
use std::{fs, path::{Path, PathBuf}, time::UNIX_EPOCH};

pub fn cache_dir() -> Result<PathBuf, String> {
    let project = ProjectDirs::from("com", "zernia", "zernia image").ok_or("캐시 경로를 찾을 수 없습니다.")?;
    Ok(project.cache_dir().join("thumbnails"))
}

fn cached_path(path: &str, size: u32) -> Result<PathBuf, String> {
    let source = Path::new(path);
    let meta = fs::metadata(source).map_err(|e| e.to_string())?;
    let modified = meta.modified().ok().and_then(|v| v.duration_since(UNIX_EPOCH).ok()).map(|v| v.as_secs()).unwrap_or(0);
    let key = blake3::hash(format!("{}:{}:{}:{}", path, meta.len(), modified, size).as_bytes()).to_hex().to_string();
    let directory = cache_dir()?; fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    Ok(directory.join(format!("{key}.webp")))
}

pub fn lookup(path: &str, size: u32) -> Result<Option<String>, String> {
    let cached = cached_path(path, size)?;
    Ok(cached.exists().then(|| cached.to_string_lossy().to_string()))
}

pub fn create(path: &str, size: u32) -> Result<String, String> {
    let source = Path::new(path);
    let cached = cached_path(path, size)?;
    if cached.exists() { return Ok(cached.to_string_lossy().to_string()); }
    let decoded = image::ImageReader::open(source).map_err(|e| e.to_string())?.with_guessed_format().map_err(|e| e.to_string())?.decode().map_err(|e| format!("이미지 디코딩 실패: {e}"))?;
    let thumb = decoded.thumbnail(size, size);
    let temporary = cached.with_extension("tmp");
    thumb.save_with_format(&temporary, ImageFormat::WebP).map_err(|e| e.to_string())?;
    fs::rename(&temporary, &cached).map_err(|e| e.to_string())?;
    Ok(cached.to_string_lossy().to_string())
}
