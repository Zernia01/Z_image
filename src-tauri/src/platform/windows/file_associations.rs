/// Windows의 보호된 UserChoice 값을 수정하지 않고 공식 기본 앱 설정을 엽니다.
/// 실제 파일 연결 등록과 제거는 Tauri 설치기의 `bundle.fileAssociations`가 담당합니다.
pub fn open_default_apps_settings() -> Result<(), String> {
    std::process::Command::new("explorer.exe")
        .arg("ms-settings:defaultapps")
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}
