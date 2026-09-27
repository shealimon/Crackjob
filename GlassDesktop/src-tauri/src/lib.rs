use std::time::Duration;
use tauri::{
    Manager, RunEvent, WebviewWindow, WindowEvent,
};

fn configure_transparent_webview(window: &WebviewWindow) {
    let _ = window.set_background_color(None);

    #[cfg(windows)]
    {
        let _ = window.with_webview(|webview| {
            use webview2_com::Microsoft::Web::WebView2::Win32::{
                COREWEBVIEW2_COLOR, ICoreWebView2Controller2,
            };
            use windows::core::Interface;

            unsafe {
                let Ok(controller) = webview.controller().cast::<ICoreWebView2Controller2>() else {
                    return;
                };
                let clear = COREWEBVIEW2_COLOR {
                    R: 0,
                    G: 0,
                    B: 0,
                    A: 0,
                };
                let _ = controller.SetDefaultBackgroundColor(clear);
            }
        });

        if let Ok(hwnd) = window.hwnd() {
            use windows::Win32::Graphics::Dwm::DwmExtendFrameIntoClientArea;
            use windows::Win32::UI::Controls::MARGINS;
            unsafe {
                let margins = MARGINS {
                    cxLeftWidth: -1,
                    cxRightWidth: -1,
                    cyTopHeight: -1,
                    cyBottomHeight: -1,
                };
                let _ = DwmExtendFrameIntoClientArea(hwnd, &margins);
            }
        }
    }
}

fn schedule_transparency_pass(window: WebviewWindow) {
    std::thread::spawn(move || {
        for delay_ms in [0_u64, 50, 150, 400] {
            if delay_ms > 0 {
                std::thread::sleep(Duration::from_millis(delay_ms));
            }
            let pass_window = window.clone();
            let _ = window.run_on_main_thread(move || {
                configure_transparent_webview(&pass_window);
            });
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                configure_transparent_webview(&window);
                schedule_transparency_pass(window);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if !matches!(event, WindowEvent::Focused(true)) {
                return;
            }
            let handle = window.app_handle();
            if let Some(webview_window) = handle.get_webview_window(window.label()) {
                configure_transparent_webview(&webview_window);
            }
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            if let RunEvent::Ready = event {
                if let Some(window) = app_handle.get_webview_window("main") {
                    configure_transparent_webview(&window);
                    schedule_transparency_pass(window);
                }
            }
        });
}
