use image::{DynamicImage, RgbImage, RgbaImage};

pub fn decode(data: &[u8]) -> Result<DynamicImage, String> {
    pixel_buffer_to_image(
        zenavif::decode_with(
            data,
            &zenavif::DecoderConfig::new().prefer_8bit(true),
            &zenavif::Unstoppable,
        )
        .map_err(|error| format!("AVIF 디코딩 실패: {error}"))?,
    )
}

pub fn pixel_buffer_to_image(buffer: zenavif::PixelBuffer) -> Result<DynamicImage, String> {
    let width = buffer.width();
    let height = buffer.height();
    let has_alpha = buffer.has_alpha();
    let bytes = buffer.copy_to_contiguous_bytes();

    if has_alpha {
        RgbaImage::from_raw(width, height, bytes)
            .map(DynamicImage::ImageRgba8)
            .ok_or_else(|| "AVIF RGBA 픽셀 크기가 올바르지 않습니다.".to_string())
    } else {
        RgbImage::from_raw(width, height, bytes)
            .map(DynamicImage::ImageRgb8)
            .ok_or_else(|| "AVIF RGB 픽셀 크기가 올바르지 않습니다.".to_string())
    }
}
