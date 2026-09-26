use crate::models::ImageMetadata;
use exif::{In, Reader, Tag};
use image::GenericImageView;
use std::{fs, io::BufReader, path::Path, time::UNIX_EPOCH};

pub fn read(path: &str) -> Result<ImageMetadata, String> {
    let source = Path::new(path); let stat = fs::metadata(source).map_err(|e| e.to_string())?;
    let timestamp = |value: Result<std::time::SystemTime, std::io::Error>| value.ok().and_then(|v| v.duration_since(UNIX_EPOCH).ok()).map(|v| v.as_millis() as u64);
    let dimensions = image::ImageReader::open(source).ok().and_then(|r| r.with_guessed_format().ok()).and_then(|r| r.into_dimensions().ok());
    let decoded_info = image::open(source).ok().map(|i| (i.dimensions(), format!("{:?}", i.color())));
    let exif = fs::File::open(source).ok().and_then(|f| Reader::new().read_from_container(&mut BufReader::new(f)).ok());
    let field = |tag: Tag| exif.as_ref().and_then(|e| e.get_field(tag, In::PRIMARY)).map(|v| v.display_value().with_unit(exif.as_ref().unwrap()).to_string());
    let dims = dimensions.or_else(|| decoded_info.as_ref().map(|v| v.0));
    Ok(ImageMetadata {
        path: path.into(), filename: source.file_name().and_then(|x| x.to_str()).unwrap_or("").into(), extension: source.extension().and_then(|x| x.to_str()).unwrap_or("").to_ascii_lowercase(),
        mime_type: mime_guess::from_path(source).first().map(|m| m.to_string()), size: stat.len(), created_at: timestamp(stat.created()), modified_at: timestamp(stat.modified()),
        width: dims.map(|v| v.0), height: dims.map(|v| v.1), color_type: decoded_info.map(|v| v.1), camera_make: field(Tag::Make), camera_model: field(Tag::Model),
        lens_model: field(Tag::LensModel), captured_at: field(Tag::DateTimeOriginal), iso: field(Tag::PhotographicSensitivity), exposure: field(Tag::ExposureTime),
        aperture: field(Tag::FNumber), focal_length: field(Tag::FocalLength),
    })
}
