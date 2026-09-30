use tauri::WebviewWindow;
use windows::Win32::{
    Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    },
    UI::WindowsAndMessaging::{
        SetWindowPos, HWND_TOPMOST, SWP_FRAMECHANGED, SWP_SHOWWINDOW,
    },
};

pub fn set(window: &WebviewWindow, enabled: bool) -> Result<(), String> {
    if !enabled {
        window.set_always_on_top(false).map_err(|e| e.to_string())?;
        window.set_fullscreen(false).map_err(|e| e.to_string())?;
        window.set_decorations(true).map_err(|e| e.to_string())?;
        return Ok(());
    }

    window.set_decorations(false).map_err(|e| e.to_string())?;
    window.set_fullscreen(true).map_err(|e| e.to_string())?;
    window.set_always_on_top(true).map_err(|e| e.to_string())?;

    let hwnd = window.hwnd().map_err(|e| e.to_string())?;
    let monitor = unsafe { MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST) };
    if monitor.0.is_null() {
        return Err("현재 모니터를 찾을 수 없습니다.".to_string());
    }

    let mut info = MONITORINFO {
        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };
    if !unsafe { GetMonitorInfoW(monitor, &mut info) }.as_bool() {
        return Err("모니터 전체 영역을 확인할 수 없습니다.".to_string());
    }

    let bounds = info.rcMonitor;
    unsafe {
        SetWindowPos(
            hwnd,
            Some(HWND_TOPMOST),
            bounds.left,
            bounds.top,
            bounds.right - bounds.left,
            bounds.bottom - bounds.top,
            SWP_FRAMECHANGED | SWP_SHOWWINDOW,
        )
    }
    .map_err(|e| e.to_string())
}
