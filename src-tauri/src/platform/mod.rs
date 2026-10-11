#[cfg(target_os = "windows")]
mod windows;

pub fn open_default_apps_settings() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        windows::file_associations::open_default_apps_settings()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("이 기능은 Windows에서만 사용할 수 있습니다.".to_string())
    }
}

pub fn register_file_associations() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        windows::file_associations::register()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

pub fn set_native_fullscreen(window: &tauri::WebviewWindow, enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        windows::fullscreen::set(window, enabled)
    }
    #[cfg(not(target_os = "windows"))]
    {
        window.set_fullscreen(enabled).map_err(|e| e.to_string())
    }
}
