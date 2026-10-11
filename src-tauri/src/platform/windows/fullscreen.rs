use tauri::WebviewWindow;
use windows::Win32::{
    Foundation::RECT,
    Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST},
    Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DEFAULT,
        DWMWCP_DONOTROUND,
    },
    UI::WindowsAndMessaging::{
        GetClientRect, SetWindowPos, HWND_TOPMOST, SWP_FRAMECHANGED, SWP_NOACTIVATE,
        SWP_SHOWWINDOW,
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
    // 먼저 Tauri의 기본 전체화면 전환을 요청하고, 프런트엔드에서 메시지 처리가
    // 끝난 뒤 sync_bounds를 호출해 최상위 창과 WebView를 함께 보정한다.
    set_corner_preference(window, DWMWCP_DONOTROUND)
}

/// Tauri의 전체화면 메시지가 처리된 뒤 최상위 창과 WebView의 물리 크기를
/// 같은 모니터 경계로 다시 맞춘다. Windows 배율 또는 자동 숨김 작업 표시줄을
/// 사용할 때 WebView만 작업 영역 높이에 남아 생기는 하단 검은 띠를 방지한다.
pub fn sync_bounds(window: &WebviewWindow) -> Result<(), String> {
    let hwnd = window.hwnd().map_err(|e| e.to_string())?;
    let monitor = unsafe { MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST) };
    let mut monitor_info = MONITORINFO {
        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };
    unsafe { GetMonitorInfoW(monitor, &mut monitor_info) }
        .ok()
        .map_err(|e| e.to_string())?;

    let bounds = monitor_info.rcMonitor;
    unsafe {
        SetWindowPos(
            hwnd,
            Some(HWND_TOPMOST),
            bounds.left,
            bounds.top,
            bounds.right - bounds.left,
            bounds.bottom - bounds.top,
            SWP_FRAMECHANGED | SWP_NOACTIVATE | SWP_SHOWWINDOW,
        )
    }
    .map_err(|e| e.to_string())?;

    let mut client = RECT::default();
    unsafe { GetClientRect(hwnd, &mut client) }.map_err(|e| e.to_string())?;
    let width = (client.right - client.left).max(1) as u32;
    let height = (client.bottom - client.top).max(1) as u32;
    window
        .as_ref()
        .set_bounds(tauri::Rect {
            position: tauri::PhysicalPosition::new(0, 0).into(),
            size: tauri::PhysicalSize::new(width, height).into(),
        })
        .map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}
