use tauri::WebviewWindow;
use windows::Win32::Graphics::Dwm::{
    DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DEFAULT,
    DWMWCP_DONOTROUND,
};

fn set_corner_preference(
    window: &WebviewWindow,
    preference: windows::Win32::Graphics::Dwm::DWM_WINDOW_CORNER_PREFERENCE,
) -> Result<(), String> {
    let hwnd = window.hwnd().map_err(|e| e.to_string())?;
    unsafe {
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            &preference as *const _ as *const std::ffi::c_void,
            std::mem::size_of_val(&preference) as u32,
        )
    }
    .map_err(|e| e.to_string())
}

pub fn set(window: &WebviewWindow, enabled: bool) -> Result<(), String> {
    if enabled {
        if window.is_fullscreen().map_err(|e| e.to_string())? {
            return Ok(());
        }

        // 최대화 해제를 먼저 호출하면 Windows가 복원 애니메이션을 표시한 뒤
        // 전체화면으로 전환한다. 중간 상태 없이 Tauri가 현재 창 배치를 직접
        // 저장하게 하여 어느 창 크기에서든 즉시 전체화면으로 전환한다.
        window.set_fullscreen(true).map_err(|e| e.to_string())?;
        let _ = set_corner_preference(window, DWMWCP_DONOTROUND);
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    if window.is_fullscreen().map_err(|e| e.to_string())? {
        window.set_fullscreen(false).map_err(|e| e.to_string())?;
    }
    let _ = set_corner_preference(window, DWMWCP_DEFAULT);
    window.set_focus().map_err(|e| e.to_string())
}
