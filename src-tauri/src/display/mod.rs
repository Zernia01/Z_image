use crate::avif;
use directories::ProjectDirs;
use image::ImageFormat;
use std::{
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

pub fn cache_dir() -> Result<PathBuf, String> {
    let project = ProjectDirs::from("com", "zernia", "zernia image")
        .ok_or("캐시 경로를 찾을 수 없습니다.")?;
    Ok(project.cache_dir().join("display"))
}

pub fn prepare(path: &str) -> Result<String, String> {
    let source = Path::new(path);
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    // WebView2가 직접 표시하지 못하거나 버전에 따라 지원이 달라지는 형식만
    // PNG 표시 캐시로 변환한다. 나머지는 원본 경로를 그대로 사용한다.
    if !matches!(extension.as_str(), "avif" | "tif" | "tiff" | "ico" | "dib") {
        return Ok(path.to_string());
    }

    let metadata = fs::metadata(source).map_err(|error| error.to_string())?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_secs())
        .unwrap_or(0);
    let key = blake3::hash(
        format!(
            "{}:{}:{}",
            source.to_string_lossy(),
            metadata.len(),
            modified
        )
        .as_bytes(),
    )
    .to_hex()
    .to_string();
    let directory = cache_dir()?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let cached = directory.join(format!("{key}.png"));
    if cached.exists() {
        return Ok(cached.to_string_lossy().into_owned());
    }

    let decoded = if extension == "avif" {
        avif::decode(&fs::read(source).map_err(|error| error.to_string())?)?
    } else {
        image::ImageReader::open(source)
            .map_err(|error| error.to_string())?
            .with_guessed_format()
            .map_err(|error| error.to_string())?
            .decode()
            .map_err(|error| format!("이미지 디코딩 실패: {error}"))?
    };
    let temporary = directory.join(format!("{key}.tmp"));
    decoded
        .save_with_format(&temporary, ImageFormat::Png)
        .map_err(|error| format!("표시 캐시 저장 실패: {error}"))?;
    fs::rename(&temporary, &cached).map_err(|error| error.to_string())?;
    Ok(cached.to_string_lossy().into_owned())
}
