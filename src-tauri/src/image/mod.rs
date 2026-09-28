pub const SUPPORTED_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "jpe", "jfif", "png", "apng", "webp", "gif", "bmp", "dib", "tif", "tiff",
    "avif", "heic", "heif", "jxl", "ico", "qoi", "svg", "hdr", "exr", "dng", "cr2", "cr3", "nef",
    "nrw", "arw", "raf", "orf", "rw2", "pef",
];

pub fn is_supported(extension: &str) -> bool {
    SUPPORTED_EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str())
}
