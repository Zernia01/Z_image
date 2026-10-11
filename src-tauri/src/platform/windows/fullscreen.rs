use std::sync::atomic::{AtomicBool, Ordering};

use tauri::WebviewWindow;
use windows::Win32::Graphics::Dwm::{
    DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DEFAULT,
    DWMWCP_DONOTROUND,
};

// 전체화면 진입 전 최대화 상태를 기억했다가 창 모드로 돌아올 때 복원한다.
// 창 장식, 모니터 경계와 작업 표시줄 처리는 Tauri의 네이티브 전체화면에 맡긴다.
static RESTORE_MAXIMIZED: AtomicBool = AtomicBool::new(false);

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

        let was_maximized = window.is_maximized().map_err(|e| e.to_string())?;
        RESTORE_MAXIMIZED.store(was_maximized, Ordering::Relaxed);
        if was_maximized {
            window.unmaximize().map_err(|e| e.to_string())?;
        }

        window.set_fullscreen(true).map_err(|e| e.to_string())?;
        let _ = set_corner_preference(window, DWMWCP_DONOTROUND);
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    if window.is_fullscreen().map_err(|e| e.to_string())? {
        window.set_fullscreen(false).map_err(|e| e.to_string())?;
    }
    let _ = set_corner_preference(window, DWMWCP_DEFAULT);
    if RESTORE_MAXIMIZED.swap(false, Ordering::Relaxed) {
        window.maximize().map_err(|e| e.to_string())?;
    }
    window.set_focus().map_err(|e| e.to_string())
}
