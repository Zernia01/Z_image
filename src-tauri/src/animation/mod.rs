use crate::{
    avif,
    models::{AnimationFrameInfo, AnimationInfo},
};
use directories::ProjectDirs;
use image::{
    codecs::{gif::GifDecoder, png::PngDecoder, webp::WebPDecoder},
    metadata::LoopCount,
    AnimationDecoder, DynamicImage, ImageFormat,
};
use std::{
    fs::{self, File},
    io::BufReader,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

const MAX_FRAMES: usize = 10_000;

pub fn decode(path: &str) -> Result<Option<AnimationInfo>, String> {
    let source = Path::new(path);
    let format = image::ImageReader::open(source)
        .map_err(|error| error.to_string())?
        .with_guessed_format()
        .map_err(|error| error.to_string())?
        .format();
    if !matches!(
        format,
        Some(ImageFormat::Gif | ImageFormat::Png | ImageFormat::WebP | ImageFormat::Avif)
    ) {
        return Ok(None);
    }

    let directory = animation_cache_dir(source)?;
    let manifest = directory.join("animation.json");
    if manifest.exists() {
        let content = fs::read_to_string(&manifest).map_err(|error| error.to_string())?;
        if let Ok(info) = serde_json::from_str::<AnimationInfo>(&content) {
            if info.frames.len() > 1
                && info
                    .frames
                    .iter()
                    .all(|frame| Path::new(&frame.path).exists())
            {
                return Ok(Some(info));
            }
        }
    }

    if directory.exists() {
        fs::remove_dir_all(&directory).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;

    let decoded = match format {
        Some(ImageFormat::Gif) => {
            let decoder = GifDecoder::new(BufReader::new(
                File::open(source).map_err(|error| error.to_string())?,
            ))
            .map_err(|error| format!("GIF 디코딩 실패: {error}"))?;
            let loops = loop_count(decoder.loop_count());
            write_frames("GIF", loops, decoder, &directory)?
        }
        Some(ImageFormat::Png) => {
            let decoder = PngDecoder::new(BufReader::new(
                File::open(source).map_err(|error| error.to_string())?,
            ))
            .map_err(|error| format!("PNG 디코딩 실패: {error}"))?;
            if !decoder.is_apng().map_err(|error| error.to_string())? {
                cleanup_empty(&directory);
                return Ok(None);
            }
            let decoder = decoder
                .apng()
                .map_err(|error| format!("APNG 디코딩 실패: {error}"))?;
            let loops = loop_count(decoder.loop_count());
            write_frames("APNG", loops, decoder, &directory)?
        }
        Some(ImageFormat::WebP) => {
            let decoder = WebPDecoder::new(BufReader::new(
                File::open(source).map_err(|error| error.to_string())?,
            ))
            .map_err(|error| format!("WebP 디코딩 실패: {error}"))?;
            if !decoder.has_animation() {
                cleanup_empty(&directory);
                return Ok(None);
            }
            let loops = loop_count(decoder.loop_count());
            write_frames("Animated WebP", loops, decoder, &directory)?
        }
        Some(ImageFormat::Avif) => {
            let bytes = fs::read(source).map_err(|error| error.to_string())?;
            let animation = match zenavif::decode_animation_with(
                &bytes,
                &zenavif::DecoderConfig::new().prefer_8bit(true),
                &zenavif::Unstoppable,
            ) {
                Ok(animation) => animation,
                Err(_) => {
                    cleanup_empty(&directory);
                    return Ok(None);
                }
            };
            if animation.frames.len() < 2 {
                cleanup_empty(&directory);
                return Ok(None);
            }
            let loops = (animation.info.loop_count != 0).then_some(animation.info.loop_count);
            let mut frames = Vec::with_capacity(animation.frames.len());
            for (index, frame) in animation.frames.into_iter().enumerate() {
                if index >= MAX_FRAMES {
                    return Err(format!("애니메이션 프레임이 {MAX_FRAMES}개를 초과합니다."));
                }
                let frame_path = directory.join(format!("frame-{index:05}.png"));
                avif::pixel_buffer_to_image(frame.pixels)?
                    .save_with_format(&frame_path, ImageFormat::Png)
                    .map_err(|error| format!("AVIF 프레임 캐시 저장 실패: {error}"))?;
                frames.push(AnimationFrameInfo {
                    path: frame_path.to_string_lossy().into_owned(),
                    delay_ms: u64::from(frame.duration_ms).clamp(10, 60_000),
                });
            }
            AnimationInfo {
                format: "Animated AVIF".to_string(),
                loop_count: loops,
                frames,
            }
        }
        _ => unreachable!(),
    };

    if decoded.frames.len() < 2 {
        cleanup_empty(&directory);
        return Ok(None);
    }
    let temporary = directory.join("animation.tmp");
    fs::write(
        &temporary,
        serde_json::to_vec(&decoded).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    fs::rename(temporary, manifest).map_err(|error| error.to_string())?;
    Ok(Some(decoded))
}

fn write_frames<'a, D: AnimationDecoder<'a>>(
    format: &str,
    loops: Option<u32>,
    decoder: D,
    directory: &Path,
) -> Result<AnimationInfo, String> {
    let mut frames = Vec::new();
    for (index, frame) in decoder.into_frames().enumerate() {
        if index >= MAX_FRAMES {
            return Err(format!("애니메이션 프레임이 {MAX_FRAMES}개를 초과합니다."));
        }
        let frame = frame.map_err(|error| format!("{format} 프레임 디코딩 실패: {error}"))?;
        let (numerator, denominator) = frame.delay().numer_denom_ms();
        let delay_ms = if denominator == 0 {
            100
        } else {
            (u64::from(numerator) / u64::from(denominator)).clamp(10, 60_000)
        };
        let frame_path = directory.join(format!("frame-{index:05}.png"));
        DynamicImage::ImageRgba8(frame.into_buffer())
            .save_with_format(&frame_path, ImageFormat::Png)
            .map_err(|error| format!("프레임 캐시 저장 실패: {error}"))?;
        frames.push(AnimationFrameInfo {
            path: frame_path.to_string_lossy().into_owned(),
            delay_ms,
        });
    }
    Ok(AnimationInfo {
        format: format.to_string(),
        loop_count: loops,
        frames,
    })
}

fn loop_count(value: LoopCount) -> Option<u32> {
    match value {
        LoopCount::Infinite => None,
        LoopCount::Finite(count) => Some(count.get()),
    }
}

fn animation_cache_dir(source: &Path) -> Result<PathBuf, String> {
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
    Ok(cache_dir()?.join(key))
}

pub fn cache_dir() -> Result<PathBuf, String> {
    let project = ProjectDirs::from("com", "zernia", "zernia image")
        .ok_or("캐시 경로를 찾을 수 없습니다.")?;
    Ok(project.cache_dir().join("animations"))
}

fn cleanup_empty(directory: &Path) {
    let _ = fs::remove_dir_all(directory);
}
