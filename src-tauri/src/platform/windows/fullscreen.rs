use tauri::WebviewWindow;
use windows::Win32::{
    Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DEFAULT,
        DWMWCP_DONOTROUND,
    },
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
    if !enabled {
        let _ = set_corner_preference(window, DWMWCP_DEFAULT);
        window.set_fullscreen(false).map_err(|e| e.to_string())?;
        window.set_always_on_top(false).map_err(|e| e.to_string())?;
        window.set_decorations(true).map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    window.set_decorations(false).map_err(|e| e.to_string())?;
    window.set_fullscreen(true).map_err(|e| e.to_string())?;
    window.set_always_on_top(true).map_err(|e| e.to_string())?;
    // Shell에 등록된 전체화면 창이 전면 포커스를 가져야 작업 표시줄이
    // 즉시 뒤로 내려간다.
    window.set_focus().map_err(|e| e.to_string())?;
    // Tauri가 모니터의 정확한 전체 영역과 WebView 크기를 함께 갱신한다.
    // 여기서 HWND만 다시 SetWindowPos로 확대하면 WebView 높이가 작업 영역에
    // 남아 하단에 검은 띠가 생길 수 있으므로 별도의 크기 보정은 하지 않는다.
    set_corner_preference(window, DWMWCP_DONOTROUND)
}
