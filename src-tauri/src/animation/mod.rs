use crate::{
    avif,
    models::{AnimationFrameInfo, AnimationInfo},
};
use directories::ProjectDirs;
use image::{
    codecs::{
        gif::GifDecoder,
        png::{CompressionType, FilterType, PngDecoder, PngEncoder},
        webp::WebPDecoder,
    },
    metadata::LoopCount,
    AnimationDecoder, ExtendedColorType, ImageEncoder, ImageFormat, RgbaImage,
};
use std::{
    fs::{self, File},
    io::{BufReader, BufWriter},
    panic::{catch_unwind, AssertUnwindSafe},
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

const MAX_FRAMES: usize = 10_000;
const CACHE_SCHEMA_VERSION: u8 = 3;

pub fn decode(path: &str) -> Result<Option<AnimationInfo>, String> {
    catch_unwind(AssertUnwindSafe(|| decode_inner(path)))
        .map_err(|_| "애니메이션 디코더가 예기치 않게 중단되었습니다.".to_string())?
}

fn decode_inner(path: &str) -> Result<Option<AnimationInfo>, String> {
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
            // 모든 프레임을 한 번에 메모리에 올리면 고해상도 AVIF에서 프로세스가
            // 종료될 수 있다. 프레임 단위 디코더로 즉시 PNG 캐시에 흘려 보낸다.
            let config = zenavif::DecoderConfig::new()
                // 0은 사용 가능한 CPU 코어를 자동으로 활용한다. AVIF 프레임을
                // 한 코어로만 디코딩하던 기존 설정이 긴 대기의 주원인이었다.
                .threads(0)
                .prefer_8bit(true)
                .frame_size_limit(8192 * 8192);
            let mut decoder = match zenavif::AnimationDecoder::new(&bytes, &config) {
                Ok(decoder) => decoder,
                Err(_) => {
                    cleanup_empty(&directory);
                    return Ok(None);
                }
            };
            let frame_count = decoder.info().frame_count;
            if frame_count < 2 {
                cleanup_empty(&directory);
                return Ok(None);
            }
            if frame_count > MAX_FRAMES {
                cleanup_empty(&directory);
                return Err(format!("애니메이션 프레임이 {MAX_FRAMES}개를 초과합니다."));
            }
            let loop_count = decoder.info().loop_count;
            let loops = (loop_count != 0).then_some(loop_count);
            let mut frames = Vec::with_capacity(frame_count);
            for index in 0..frame_count {
                let frame = decoder
                    .next_frame(&zenavif::Unstoppable)
                    .map_err(|error| format!("AVIF {index}번 프레임 디코딩 실패: {error}"))?
                    .ok_or_else(|| format!("AVIF {index}번 프레임이 없습니다."))?;
                let frame_path = directory.join(format!("frame-{index:05}.png"));
                let image = avif::pixel_buffer_to_image(frame.pixels)?.to_rgba8();
                save_frame_fast(&frame_path, &image)
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
        save_frame_fast(&frame_path, &frame.into_buffer())
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

/// 애니메이션 캐시는 배포 파일이 아니라 재생용 임시 데이터다. 압축률보다
/// 생성 속도가 중요하므로 필터 탐색을 생략한 빠른 PNG로 기록한다.
fn save_frame_fast(path: &Path, image: &RgbaImage) -> Result<(), image::ImageError> {
    let writer = BufWriter::new(File::create(path)?);
    PngEncoder::new_with_quality(writer, CompressionType::Fast, FilterType::NoFilter)
        .write_image(
            image.as_raw(),
            image.width(),
            image.height(),
            ExtendedColorType::Rgba8,
        )
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
            "{}:{}:{}:{}",
            CACHE_SCHEMA_VERSION,
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
