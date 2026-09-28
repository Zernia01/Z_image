use serde::{Deserialize, Serialize};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageEntry {
    pub id: String,
    pub path: String,
    pub filename: String,
    pub extension: String,
    pub size: u64,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub created_at: Option<u64>,
    pub modified_at: Option<u64>,
    pub thumbnail_state: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageMetadata {
    pub path: String,
    pub filename: String,
    pub extension: String,
    pub mime_type: Option<String>,
    pub size: u64,
    pub created_at: Option<u64>,
    pub modified_at: Option<u64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub color_type: Option<String>,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub lens_model: Option<String>,
    pub captured_at: Option<String>,
    pub iso: Option<String>,
    pub exposure: Option<String>,
    pub aperture: Option<String>,
    pub focal_length: Option<String>,
}

#[derive(Serialize)]
pub struct CacheStats {
    pub bytes: u64,
    pub files: u64,
}

#[derive(Serialize)]
pub struct MoveResult {
    pub from: String,
    pub to: String,
}

#[derive(Serialize)]
pub struct FileBatchResult<T> {
    pub succeeded: Vec<T>,
    pub failed: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DropResult {
    pub folder: Option<String>,
    pub images: Vec<ImageEntry>,
    pub active_path: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnimationFrameInfo {
    pub path: String,
    pub delay_ms: u64,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnimationInfo {
    pub format: String,
    pub loop_count: Option<u32>,
    pub frames: Vec<AnimationFrameInfo>,
}
