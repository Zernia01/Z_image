use crate::{animation, display, models::CacheStats, thumbnail};
use std::fs;
pub fn stats() -> Result<CacheStats, String> {
    let mut result = CacheStats { bytes: 0, files: 0 };
    for dir in [
        thumbnail::cache_dir()?,
        display::cache_dir()?,
        animation::cache_dir()?,
    ] {
        if dir.exists() {
            accumulate(&dir, &mut result)?;
        }
    }
    Ok(result)
}
pub fn clear() -> Result<(), String> {
    for dir in [
        thumbnail::cache_dir()?,
        display::cache_dir()?,
        animation::cache_dir()?,
    ] {
        if dir.exists() {
            fs::remove_dir_all(dir).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn accumulate(dir: &std::path::Path, result: &mut CacheStats) -> Result<(), String> {
    for entry in fs::read_dir(dir)
        .map_err(|error| error.to_string())?
        .flatten()
    {
        if entry.path().is_dir() {
            accumulate(&entry.path(), result)?;
        } else if let Ok(metadata) = entry.metadata() {
            result.bytes += metadata.len();
            result.files += 1;
        }
    }
    Ok(())
}
