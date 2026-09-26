use crate::{models::CacheStats, thumbnail::cache_dir};
use std::fs;
pub fn stats() -> Result<CacheStats, String> {
    let dir = cache_dir()?; if !dir.exists() { return Ok(CacheStats { bytes:0, files:0 }); }
    let mut result = CacheStats { bytes:0, files:0 };
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())?.flatten() { if let Ok(meta)=entry.metadata() { result.bytes += meta.len(); result.files += 1; } }
    Ok(result)
}
pub fn clear() -> Result<(), String> { let dir=cache_dir()?; if dir.exists() { fs::remove_dir_all(dir).map_err(|e| e.to_string())?; } Ok(()) }
