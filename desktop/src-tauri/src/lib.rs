mod audio;
mod interview_log;
mod screenshot;
mod session;
mod session_crypto;
mod stealth;

use audio::AudioEngine;
use serde::Serialize;
use session::Prefs;
use stealth::StealthStatus;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};

pub struct AppState {
    click_through: AtomicBool,
    app_visible: AtomicBool,
    /// When true, ExitRequested must not call prevent_exit (Quit button / quit_app).
    force_quit: AtomicBool,
    overlay_open: AtomicBool,
    overlay_compact: AtomicBool,
    overlay_logical_height: Mutex<f64>,
    interview_active: AtomicBool,
    share_fallback_hidden: AtomicBool,
    audio: AudioEngine,
    prefs: Mutex<Prefs>,
    last_capture: Mutex<Option<String>>,
    last_capture_at: Mutex<Option<Instant>>,
    capture_lock: Mutex<()>,
    last_toggle: Mutex<Option<Instant>>,
    last_move: Mutex<Option<Instant>>,
    move_repeat_stop: Mutex<Option<std::sync::Arc<AtomicBool>>>,
    scroll_repeat_stop: Mutex<Option<std::sync::Arc<AtomicBool>>>,
    last_programmatic_move: Mutex<Option<Instant>>,
}

fn interview_required(app: &AppHandle) -> bool {
    app.try_state::<AppState>()
        .map(|state| state.interview_active.load(Ordering::SeqCst))
        .unwrap_or(false)
}

fn emit_interview_required(app: &AppHandle) {
    let _ = app.emit(
        "interview-required",
        serde_json::json!({ "error": "Click Start to begin the interview first." }),
    );
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CaptureReady {
    image_base64: String,
    mime_type: String,
}

fn activate_auto_stealth(app: &AppHandle, state: &AppState) {
    state.click_through.store(false, Ordering::SeqCst);
    stealth::apply_auto_stealth(app);
}

#[tauri::command]
fn load_prefs(app: AppHandle, state: State<AppState>) -> Prefs {
    let prefs = session::normalize_prefs(session::load_prefs(&app));
    let _ = session::save_prefs(&app, &prefs);
    if let Ok(mut slot) = state.prefs.lock() {
        *slot = prefs.clone();
    }
    activate_auto_stealth(&app, &state);
    prefs
}

#[tauri::command]
fn save_prefs(app: AppHandle, state: State<AppState>, prefs: Prefs) -> Result<Prefs, String> {
    let prefs = session::normalize_prefs(prefs);
    session::save_prefs(&app, &prefs)?;
    if let Ok(mut slot) = state.prefs.lock() {
        *slot = prefs.clone();
    }
    activate_auto_stealth(&app, &state);
    let _ = app.emit(
        "overlay-opacity",
        serde_json::json!({ "opacity": prefs.overlay_opacity }),
    );
    Ok(prefs)
}

#[tauri::command]
fn set_interview_active(app: AppHandle, state: State<AppState>, active: bool) -> Result<(), String> {
    state.interview_active.store(active, Ordering::SeqCst);
    if !active {
        clear_session(&state);
    }
    let _ = app.emit("interview-active", serde_json::json!({ "active": active }));
    Ok(())
}

#[tauri::command]
fn is_interview_active(state: State<AppState>) -> bool {
    state.interview_active.load(Ordering::SeqCst)
}

/// Photograph the desktop for interview solve.
/// LOCKED: Never hide main/overlay on Ctrl+H or capture_screenshot — UI must
/// stay visible. Stealth WDA exclusion keeps Crack out of the bitmap.
/// Do not reintroduce hide_window / sleep / restore around this path.
/// `emit_hotkey_events`: true for global Ctrl+H (capture-ready → pending UI).
/// false for programmatic invoke (activation refresh, JS takeScreenshot) — return value only.
fn capture_interview_screenshot(
    app: &AppHandle,
    state: &AppState,
    emit_hotkey_events: bool,
) -> Result<CaptureReady, String> {
    if !state.interview_active.load(Ordering::SeqCst) {
        emit_interview_required(app);
        return Err("Click Start to begin the interview first.".into());
    }

    // Serialize so a concurrent Ctrl+H never returns a duplicate stale bitmap.
    let _capture_guard = state
        .capture_lock
        .lock()
        .map_err(|e| format!("capture lock: {e}"))?;

    // Global hotkey + in-window Ctrl+H can double-fire within ~50ms — reuse only then.
    if let Ok(last_at) = state.last_capture_at.lock() {
        if let Some(prev) = *last_at {
            if prev.elapsed() < Duration::from_millis(120) {
                if let Ok(guard) = state.last_capture.lock() {
                    if let Some(existing) = guard.as_ref() {
                        let payload = CaptureReady {
                            image_base64: existing.clone(),
                            mime_type: "image/jpeg".into(),
                        };
                        // Do not emit capture-ready on dedupe — no matching capture-started,
                        // and JS would treat a stale bitmap as the latest committed frame.
                        return Ok(payload);
                    }
                }
            }
        }
    }

    if emit_hotkey_events {
        let _ = app.emit("capture-started", ());
    }
    let shot = screenshot::capture_primary_for_api(app)?;
    // Single screenshot slot — each capture overwrites the previous bitmap.
    if let Ok(mut capture) = state.last_capture.lock() {
        *capture = Some(shot.base64.clone());
    }
    if let Ok(mut last_at) = state.last_capture_at.lock() {
        *last_at = Some(Instant::now());
    }
    let payload = CaptureReady {
        image_base64: shot.base64,
        mime_type: shot.mime_type,
    };
    if emit_hotkey_events {
        let _ = app.emit("capture-ready", &payload);
    }
    Ok(payload)
}

#[tauri::command]
fn capture_screenshot(app: AppHandle, state: State<AppState>) -> Result<CaptureReady, String> {
    capture_interview_screenshot(&app, &state, false)
}

/// Same path as global Ctrl+H (capture-started / capture-ready for the main window).
#[tauri::command]
fn capture_interview_hotkey(app: AppHandle, state: State<AppState>) -> Result<CaptureReady, String> {
    capture_interview_screenshot(&app, &state, true)
}

fn emit_app_visibility(app: &AppHandle, visible: bool) {
    let _ = app.emit(
        "app-visibility",
        serde_json::json!({ "visible": visible }),
    );
}

fn monitor_for(window: &tauri::WebviewWindow) -> Option<tauri::Monitor> {
    window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten())
}

/// Initial / fallback width before JS measures the pill (`fitToolbarWindow`).
/// Keep close to real content width so first paint isn't an oversized strip.
/// ~Start + audio + 3 hotkeys + Upgrade + gear (Upgrade visible for free users).
const TOOLBAR_LOGICAL_WIDTH: f64 = 860.0;
const TOOLBAR_CHROME_HEIGHT: f64 = 64.0;
const TOOLBAR_SETTINGS_HEIGHT: f64 = 640.0;
/// Login panel size — must match `setToolbarWindowExpanded(true, 380, true)` from MainApp.
const LOGIN_LOGICAL_WIDTH: f64 = 380.0;
/// Content-fit height (not settings 640) so login isn't a dark frame around a card.
const LOGIN_LOGICAL_HEIGHT: f64 = 560.0;

fn place_toolbar_at_top(app: &AppHandle) -> Result<(), String> {
    let Some(main) = app.get_webview_window("main") else {
        return Ok(());
    };
    let Some(monitor) = monitor_for(&main) else {
        return Ok(());
    };
    let scale = monitor.scale_factor();
    let size = main.outer_size().map_err(|e| e.to_string())?;
    let area = monitor.work_area();
    // Start a bit below the screen top so the toolbar isn't flush with the edge.
    let margin = (36.0 * scale).round() as i32;
    let x = area.position.x + (area.size.width as i32 - size.width as i32) / 2;
    let y = area.position.y + margin;
    main.set_position(tauri::PhysicalPosition::new(x, y))
        .map_err(|e| e.to_string())
}

fn place_window_centered(window: &tauri::WebviewWindow) -> Result<(), String> {
    let Some(monitor) = monitor_for(window) else {
        return Ok(());
    };
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let area = monitor.work_area();
    let x = area.position.x + (area.size.width as i32 - size.width as i32) / 2;
    let y = area.position.y + (area.size.height as i32 - size.height as i32) / 2;
    window
        .set_position(tauri::PhysicalPosition::new(x, y))
        .map_err(|e| e.to_string())
}

fn max_overlay_logical_height(
    main: &tauri::WebviewWindow,
    overlay_y: i32,
    scale: f64,
) -> f64 {
    let Some(monitor) = monitor_for(main) else {
        return 720.0;
    };
    let area = monitor.work_area();
    let bottom = area.position.y + area.size.height as i32;
    let margin = (12.0 * scale).round() as i32;
    let available = (bottom - overlay_y - margin).max(160);
    available as f64 / scale
}

fn place_overlay_under_toolbar(app: &AppHandle) -> Result<(), String> {
    const OVERLAY_WIDE_HEIGHT: f64 = 560.0;
    /// Empty Start state before Q&A — roomy default (JS may override).
    const OVERLAY_COMPACT_IDLE_HEIGHT: f64 = 540.0;
    /// Floor for content-sized compact overlay (short answers can shrink).
    const OVERLAY_COMPACT_MIN_HEIGHT: f64 = 220.0;

    let Some(main) = app.get_webview_window("main") else {
        return Ok(());
    };
    let Some(overlay) = app.get_webview_window("overlay") else {
        return Ok(());
    };

    let compact = app
        .try_state::<AppState>()
        .map(|state| state.overlay_compact.load(Ordering::SeqCst))
        .unwrap_or(true);

    let scale = main.scale_factor().unwrap_or(1.0);
    let toolbar_pos = main.outer_position().map_err(|e| e.to_string())?;
    // Match output window width to the live toolbar width (not a fixed 440/680).
    let toolbar_w = main
        .outer_size()
        .map(|size| size.width as i32)
        .unwrap_or_else(|_| (TOOLBAR_LOGICAL_WIDTH * scale).round() as i32);
    // Keep overlay anchored to the compact toolbar, not the expanded settings window.
    let overlay_y =
        toolbar_pos.y + (TOOLBAR_CHROME_HEIGHT * scale).round() as i32;
    let max_logical_h = max_overlay_logical_height(&main, overlay_y, scale);

    let logical_height = if compact {
        let requested = app
            .try_state::<AppState>()
            .and_then(|state| state.overlay_logical_height.lock().ok().map(|slot| *slot))
            .unwrap_or(0.0);
        let content_h = if requested > 0.0 {
            requested
        } else {
            OVERLAY_COMPACT_IDLE_HEIGHT
        };
        content_h
            .max(OVERLAY_COMPACT_MIN_HEIGHT)
            .min(max_logical_h)
    } else {
        OVERLAY_WIDE_HEIGHT.min(max_logical_h)
    };

    let overlay_w = toolbar_w.max(1) as u32;
    let overlay_h = (logical_height * scale).round() as u32;
    // Same width as toolbar → left edges align (Ctrl+Arrow moves both together).
    let overlay_x = toolbar_pos.x;

    overlay
        .set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
            overlay_w, overlay_h,
        )))
        .map_err(|e| e.to_string())?;
    overlay
        .set_position(tauri::PhysicalPosition::new(
            overlay_x,
            overlay_y,
        ))
        .map_err(|e| e.to_string())
}

fn hide_app(app: &AppHandle, state: &AppState) -> Result<(), String> {
    if let Some(main) = app.get_webview_window("main") {
        stealth::hide_window(&main)?;
    }
    if let Some(overlay) = app.get_webview_window("overlay") {
        stealth::hide_window(&overlay)?;
    }
    state.app_visible.store(false, Ordering::SeqCst);
    emit_app_visibility(app, false);
    Ok(())
}

fn show_app(app: &AppHandle, state: &AppState) -> Result<(), String> {
    if let Some(main) = app.get_webview_window("main") {
        stealth::show_window(&main)?;
    }
    if state.overlay_open.load(Ordering::SeqCst) {
        if let Some(overlay) = app.get_webview_window("overlay") {
            stealth::show_window(&overlay)?;
            let _ = place_overlay_under_toolbar(app);
            activate_auto_stealth(app, state);
        }
    }
    state.app_visible.store(true, Ordering::SeqCst);
    emit_app_visibility(app, true);
    Ok(())
}

/// Entire-screen share: soft WDA reassert only (Electron-style content protection).
/// Never hide locally; never strip window styles here (that caused a brief UI flicker).
/// Also hide the OS cursor over Crack windows so the interviewer does not see
/// a pointer moving over the excluded (invisible) app area.
fn sync_share_protect(app: &AppHandle, sharing: bool) {
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    state.share_fallback_hidden.store(false, Ordering::SeqCst);

    if sharing {
        stealth::reassert_capture_exclusion(app);
        stealth::set_hide_cursor_during_share(app, true);
        return;
    }
    stealth::set_hide_cursor_during_share(app, false);
    stealth::reassert_capture_exclusion(app);
}

fn start_screen_share_monitor(app: AppHandle) {
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(2));
        let mut share_hits = 0u32;
        let mut idle_hits = 0u32;
        let mut last_reported: Option<bool> = None;

        loop {
            std::thread::sleep(Duration::from_millis(400));
            let sharing_now = stealth::is_active_screen_share();
            if sharing_now {
                share_hits = share_hits.saturating_add(1);
                idle_hits = 0;
            } else {
                idle_hits = idle_hits.saturating_add(1);
                share_hits = 0;
            }

            let sharing = share_hits >= 1;
            let idle = idle_hits >= 2;

            // Only act on edges — avoid hammering protect every 400ms.
            let edge_on = sharing && last_reported != Some(true);
            let edge_off = idle && last_reported != Some(false);
            if edge_on {
                eprintln!(
                    "[stealth] screen-share DETECTED — soft WDA reassert (no local hide/flicker)"
                );
                last_reported = Some(true);
            } else if edge_off {
                eprintln!("[stealth] screen-share ENDED");
                last_reported = Some(false);
            }

            if !edge_on && !edge_off {
                continue;
            }

            let handle = app.clone();
            let sharing_flag = edge_on;
            let _ = app.run_on_main_thread(move || {
                sync_share_protect(&handle, sharing_flag);
            });
        }
    });
}

fn toggle_app(app: &AppHandle, state: &AppState) -> Result<bool, String> {
    {
        let mut last = state.last_toggle.lock().map_err(|e| e.to_string())?;
        if let Some(prev) = *last {
            if prev.elapsed() < Duration::from_millis(280) {
                return Ok(state.app_visible.load(Ordering::SeqCst));
            }
        }
        *last = Some(Instant::now());
    }

    let visible = state.app_visible.load(Ordering::SeqCst);
    if visible {
        hide_app(app, state)?;
        Ok(false)
    } else {
        show_app(app, state)?;
        Ok(true)
    }
}

#[tauri::command]
fn show_overlay(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let Some(overlay) = app.get_webview_window("overlay") else {
        return Err("Overlay window missing".into());
    };
    stealth::show_window(&overlay)?;
    configure_webview(&overlay);
    activate_auto_stealth(&app, &state);
    state.overlay_open.store(true, Ordering::SeqCst);
    let _ = place_overlay_under_toolbar(&app);
    if !state.app_visible.load(Ordering::SeqCst) {
        show_app(&app, &state)?;
    } else {
        emit_app_visibility(&app, true);
    }
    Ok(())
}

#[tauri::command]
fn hide_overlay(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("overlay") {
        stealth::hide_window(&overlay)?;
    }
    state.overlay_open.store(false, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
fn toggle_overlay(app: AppHandle, state: State<AppState>) -> Result<bool, String> {
    toggle_app(&app, &state)
}

#[tauri::command]
fn get_stealth_status(app: AppHandle, state: State<AppState>) -> StealthStatus {
    let audio = state.audio.status();
    stealth::collect_stealth_status(
        &app,
        state.click_through.load(Ordering::SeqCst),
        audio.available,
        audio.capturing,
        !state.app_visible.load(Ordering::SeqCst),
        state.share_fallback_hidden.load(Ordering::SeqCst),
    )
}

#[tauri::command]
fn set_click_through(app: AppHandle, state: State<AppState>, enabled: bool) -> Result<bool, String> {
    let _ = enabled;
    activate_auto_stealth(&app, &state);
    Ok(true)
}

#[tauri::command]
fn audio_status(state: State<AppState>) -> audio::AudioStatus {
    state.audio.status()
}

#[tauri::command]
fn start_system_audio(state: State<AppState>) -> Result<audio::AudioStatus, String> {
    state.audio.start()
}

#[tauri::command]
fn stop_system_audio(state: State<AppState>) -> audio::AudioStatus {
    state.audio.stop()
}

#[tauri::command]
fn take_audio_chunk(state: State<AppState>, min_ms: u32) -> Option<audio::AudioChunk> {
    state.audio.take_chunk(min_ms)
}

#[tauri::command]
fn peek_audio_chunk(state: State<AppState>, min_ms: u32) -> Option<audio::AudioChunk> {
    state.audio.peek_chunk(min_ms)
}

#[tauri::command]
fn peek_progress_audio_chunk(state: State<AppState>, min_ms: u32) -> Option<audio::AudioChunk> {
    state.audio.peek_progress_chunk(min_ms)
}

#[tauri::command]
fn force_take_audio_chunk(state: State<AppState>, min_ms: u32) -> Option<audio::AudioChunk> {
    state.audio.force_take_chunk(min_ms)
}

#[tauri::command]
fn discard_audio_chunk(state: State<AppState>, min_ms: u32) {
    state.audio.discard_chunk(min_ms);
}

#[tauri::command]
fn set_overlay_layout(
    app: AppHandle,
    state: State<AppState>,
    compact: bool,
    height: Option<f64>,
) -> Result<(), String> {
    let prev_compact = state.overlay_compact.load(Ordering::SeqCst);
    state.overlay_compact.store(compact, Ordering::SeqCst);

    let mut height_changed = false;
    if let Some(h) = height {
        if let Ok(mut slot) = state.overlay_logical_height.lock() {
            let next = h.max(0.0);
            height_changed = (*slot - next).abs() >= 6.0;
            *slot = next;
        }
    } else if !compact {
        if let Ok(mut slot) = state.overlay_logical_height.lock() {
            *slot = 0.0;
        }
    }

    if state.overlay_open.load(Ordering::SeqCst) && (prev_compact != compact || height_changed) {
        let _ = place_overlay_under_toolbar(&app);
    }
    Ok(())
}

#[tauri::command]
fn set_toolbar_window_expanded(
    app: AppHandle,
    expanded: bool,
    width: Option<f64>,
    center: Option<bool>,
) -> Result<(), String> {
    let Some(main) = app.get_webview_window("main") else {
        return Err("Main window missing".into());
    };

    let height = if expanded {
        // `center: true` is login mode — use content-fit height, not settings panel.
        if center == Some(true) {
            LOGIN_LOGICAL_HEIGHT
        } else {
            TOOLBAR_SETTINGS_HEIGHT
        }
    } else {
        TOOLBAR_CHROME_HEIGHT
    };
    // Login ~380; measured toolbar pill is typically ~640–720.
    let logical_width = width
        .unwrap_or(TOOLBAR_LOGICAL_WIDTH)
        .clamp(360.0, 1400.0);

    if let Some(state) = app.try_state::<AppState>() {
        *state
            .last_programmatic_move
            .lock()
            .map_err(|e| e.to_string())? = Some(Instant::now());
    }

    // Keep horizontal center stable when width changes (avoids one-time left jump
    // on first settings hover after login when 860 → measured toolbar width).
    let prev_size = main.outer_size().ok();
    let prev_pos = main.outer_position().ok();

    main.set_size(tauri::Size::Logical(tauri::LogicalSize::new(
        logical_width,
        height,
    )))
    .map_err(|e| e.to_string())?;

    match center {
        Some(true) => {
            let _ = place_window_centered(&main);
        }
        Some(false) => {
            let _ = place_toolbar_at_top(&app);
        }
        None => {
            if let (Some(old_size), Some(old_pos), Ok(new_size)) =
                (prev_size, prev_pos, main.outer_size())
            {
                let dx = (old_size.width as i32 - new_size.width as i32) / 2;
                if dx != 0 {
                    let _ = main.set_position(tauri::PhysicalPosition::new(
                        old_pos.x + dx,
                        old_pos.y,
                    ));
                }
            }
        }
    }

    if expanded {
        let _ = main.set_focus();
    } else if app
        .try_state::<AppState>()
        .is_some_and(|state| state.overlay_open.load(Ordering::SeqCst))
    {
        if let Some(overlay) = app.get_webview_window("overlay") {
            let _ = overlay.set_always_on_top(true);
        }
    }

    if app
        .try_state::<AppState>()
        .is_some_and(|state| state.overlay_open.load(Ordering::SeqCst))
    {
        let _ = place_overlay_under_toolbar(&app);
    }

    Ok(())
}

fn clear_session(state: &AppState) {
    if let Ok(mut capture) = state.last_capture.lock() {
        *capture = None;
    }
    if let Ok(mut last_at) = state.last_capture_at.lock() {
        *last_at = None;
    }
}

#[tauri::command]
fn clear_stored_capture(state: State<AppState>) -> Result<(), String> {
    clear_session(&state);
    Ok(())
}

fn emit_solve_request(app: &AppHandle) {
    if !interview_required(app) {
        emit_interview_required(app);
        return;
    }
    // JS owns the authoritative screenshot slot (capture-ready / activeScreenshot).
    // Do not re-send last_capture here — it survives Ctrl+G and caused stale solves.
    let _ = app.emit("solve-requested", serde_json::json!({}));
}

#[tauri::command]
fn request_solve(app: AppHandle) -> Result<(), String> {
    emit_solve_request(&app);
    Ok(())
}

fn configure_webview(window: &tauri::WebviewWindow) {
    disable_browser_accelerators(window);
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
                // Opaque warm glass base — A=0 breaks WDA_EXCLUDEFROMCAPTURE.
                let opaque = COREWEBVIEW2_COLOR {
                    R: 0x24,
                    G: 0x18,
                    B: 0x10,
                    A: 255,
                };
                let _ = controller.SetDefaultBackgroundColor(opaque);
            }
        });
    }
}

fn disable_browser_accelerators(window: &tauri::WebviewWindow) {
    #[cfg(windows)]
    {
        let _ = window.with_webview(|webview| {
            use webview2_com::Microsoft::Web::WebView2::Win32::{
                ICoreWebView2Settings3, ICoreWebView2Settings4,
            };
            use windows::core::Interface;

            unsafe {
                let Ok(core) = webview.controller().CoreWebView2() else {
                    return;
                };
                let Ok(settings) = core.Settings() else {
                    return;
                };
                if let Ok(settings3) = settings.cast::<ICoreWebView2Settings3>() {
                    // Stop WebView2 from eating Ctrl+H (History) and Ctrl+Enter.
                    let _ = settings3.SetAreBrowserAcceleratorKeysEnabled(false);
                }
                if let Ok(settings4) = settings.cast::<ICoreWebView2Settings4>() {
                    // Kill Chromium "Saved info" / password autofill popups on login.
                    let _ = settings4.SetIsGeneralAutofillEnabled(false);
                    let _ = settings4.SetIsPasswordAutosaveEnabled(false);
                }
            }
        });
    }
    let _ = window;
}

fn emit_capture(app: &AppHandle) {
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    if let Err(error) = capture_interview_screenshot(app, &state, true) {
        // interview-required already emitted inside capture_interview_screenshot
        if error.contains("Start to begin") {
            return;
        }
        let _ = app.emit("capture-error", serde_json::json!({ "error": error }));
    }
}

fn move_app_windows_impl(app: &AppHandle, dx: i32, dy: i32) -> Result<(), String> {
    if let Some(state) = app.try_state::<AppState>() {
        let mut last = state.last_move.lock().map_err(|e| e.to_string())?;
        if let Some(prev) = *last {
            if prev.elapsed() < Duration::from_millis(35) {
                return Ok(());
            }
        }
        *last = Some(Instant::now());
        *state
            .last_programmatic_move
            .lock()
            .map_err(|e| e.to_string())? = Some(Instant::now());
    }

    for label in ["main", "overlay"] {
        let Some(window) = app.get_webview_window(label) else {
            continue;
        };
        if !window.is_visible().unwrap_or(false) {
            continue;
        }
        let pos = window.outer_position().map_err(|e| e.to_string())?;
        window
            .set_position(tauri::PhysicalPosition::new(pos.x + dx, pos.y + dy))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn stop_move_repeat(state: &AppState) {
    if let Ok(mut guard) = state.move_repeat_stop.lock() {
        if let Some(stop) = guard.take() {
            stop.store(true, Ordering::SeqCst);
        }
    }
}

fn start_move_repeat(app: AppHandle, state: &AppState, dx: i32, dy: i32) {
    stop_move_repeat(state);
    let _ = move_app_windows_impl(&app, dx, dy);

    let stop = std::sync::Arc::new(AtomicBool::new(false));
    if let Ok(mut guard) = state.move_repeat_stop.lock() {
        *guard = Some(stop.clone());
    }

    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(200));
        loop {
            if stop.load(Ordering::SeqCst) {
                break;
            }
            let _ = move_app_windows_impl(&app, dx, dy);
            std::thread::sleep(Duration::from_millis(50));
        }
    });
}

fn stop_scroll_repeat(state: &AppState) {
    if let Ok(mut guard) = state.scroll_repeat_stop.lock() {
        if let Some(stop) = guard.take() {
            stop.store(true, Ordering::SeqCst);
        }
    }
}

fn emit_overlay_scroll(app: &AppHandle, dx: i32, dy: i32) {
    let _ = app.emit(
        "overlay-scroll",
        serde_json::json!({ "dx": dx, "dy": dy }),
    );
}

fn start_scroll_repeat(app: AppHandle, state: &AppState, dx: i32, dy: i32) {
    stop_scroll_repeat(state);
    emit_overlay_scroll(&app, dx, dy);

    let stop = std::sync::Arc::new(AtomicBool::new(false));
    if let Ok(mut guard) = state.scroll_repeat_stop.lock() {
        *guard = Some(stop.clone());
    }

    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(200));
        loop {
            if stop.load(Ordering::SeqCst) {
                break;
            }
            emit_overlay_scroll(&app, dx, dy);
            std::thread::sleep(Duration::from_millis(50));
        }
    });
}

#[tauri::command]
fn move_app_windows(app: AppHandle, dx: i32, dy: i32) -> Result<(), String> {
    move_app_windows_impl(&app, dx, dy)
}

#[tauri::command]
fn load_interview_day(app: AppHandle, date: String) -> interview_log::InterviewDayFile {
    interview_log::load_day(&app, &date)
}

#[tauri::command]
fn load_interview_history(
    app: AppHandle,
    max_days: Option<usize>,
) -> Result<Vec<interview_log::InterviewDayFile>, String> {
    interview_log::load_recent_days(&app, max_days.unwrap_or(14))
}

#[tauri::command]
fn append_interview_entry(
    app: AppHandle,
    date: String,
    entry: interview_log::AppendInterviewEntryInput,
) -> Result<interview_log::InterviewDayFile, String> {
    interview_log::append_entry(&app, &date, entry)
}

#[tauri::command]
fn mark_interview_synced(
    app: AppHandle,
    payload: interview_log::MarkInterviewSyncedInput,
) -> Result<interview_log::InterviewDayFile, String> {
    interview_log::mark_day_synced(&app, &payload.date)
}

#[tauri::command]
fn list_unsynced_interview_entries(
    app: AppHandle,
    max_days: Option<usize>,
) -> Result<Vec<interview_log::InterviewDayFile>, String> {
    interview_log::list_unsynced(&app, max_days.unwrap_or(30))
}

#[tauri::command]
fn quit_app(app: AppHandle, state: State<AppState>) {
    // Quit must always exit — even if Ctrl+B cloaked the UI (tray-hide path).
    state.force_quit.store(true, Ordering::SeqCst);
    state.app_visible.store(true, Ordering::SeqCst);
    stop_move_repeat(&state);

    // Best-effort: uncloak / show so WebView2 teardown is clean.
    if let Some(main) = app.get_webview_window("main") {
        let _ = stealth::show_window(&main);
    }
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = stealth::show_window(&overlay);
        let _ = overlay.hide();
    }

    app.exit(0);
}

fn hotkey_plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};

    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
            let ctrl = Modifiers::CONTROL;
            let ctrl_shift = Modifiers::CONTROL | Modifiers::SHIFT;

            let is_scroll = shortcut.matches(ctrl_shift, Code::ArrowUp)
                || shortcut.matches(ctrl_shift, Code::ArrowDown)
                || shortcut.matches(ctrl_shift, Code::ArrowLeft)
                || shortcut.matches(ctrl_shift, Code::ArrowRight);

            if is_scroll {
                let Some(state) = app.try_state::<AppState>() else {
                    return;
                };

                if event.state() == ShortcutState::Released {
                    stop_scroll_repeat(&state);
                    return;
                }

                // Match frontend SCROLL_STEP (80).
                let (dx, dy) = if shortcut.matches(ctrl_shift, Code::ArrowUp) {
                    (0, -80)
                } else if shortcut.matches(ctrl_shift, Code::ArrowDown) {
                    (0, 80)
                } else if shortcut.matches(ctrl_shift, Code::ArrowLeft) {
                    (-80, 0)
                } else {
                    (80, 0)
                };
                start_scroll_repeat(app.clone(), &state, dx, dy);
                return;
            }

            let is_move = shortcut.matches(ctrl, Code::ArrowUp)
                || shortcut.matches(ctrl, Code::ArrowDown)
                || shortcut.matches(ctrl, Code::ArrowLeft)
                || shortcut.matches(ctrl, Code::ArrowRight);

            if is_move {
                let Some(state) = app.try_state::<AppState>() else {
                    return;
                };

                if event.state() == ShortcutState::Released {
                    stop_move_repeat(&state);
                    return;
                }

                let (dx, dy) = if shortcut.matches(ctrl, Code::ArrowUp) {
                    (0, -24)
                } else if shortcut.matches(ctrl, Code::ArrowDown) {
                    (0, 24)
                } else if shortcut.matches(ctrl, Code::ArrowLeft) {
                    (-24, 0)
                } else {
                    (24, 0)
                };
                start_move_repeat(app.clone(), &state, dx, dy);
                return;
            }

            if event.state() != ShortcutState::Pressed {
                return;
            }

            if shortcut.matches(ctrl, Code::KeyH) {
                emit_capture(app);
            } else if shortcut.matches(ctrl, Code::Enter)
                || shortcut.matches(ctrl, Code::NumpadEnter)
            {
                emit_solve_request(app);
            } else if shortcut.matches(ctrl, Code::KeyG) {
                if let Some(state) = app.try_state::<AppState>() {
                    clear_session(&state);
                }
                let _ = app.emit("start-over", ());
            } else if shortcut.matches(ctrl, Code::KeyY) {
                let _ = app.emit("toggle-history", ());
            } else if shortcut.matches(ctrl, Code::KeyB) {
                if let Some(state) = app.try_state::<AppState>() {
                    if let Err(error) = toggle_app(app, &state) {
                        eprintln!("toggle_app failed: {error}");
                    }
                }
            }
        })
        .build()
}

fn register_hotkeys(app: &AppHandle) {
    use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

    let ctrl_shift = Modifiers::CONTROL | Modifiers::SHIFT;
    let shortcuts = [
        Shortcut::new(Some(Modifiers::CONTROL), Code::KeyH),
        Shortcut::new(Some(Modifiers::CONTROL), Code::Enter),
        Shortcut::new(Some(Modifiers::CONTROL), Code::KeyB),
        Shortcut::new(Some(Modifiers::CONTROL), Code::KeyG),
        Shortcut::new(Some(Modifiers::CONTROL), Code::KeyY),
        Shortcut::new(Some(Modifiers::CONTROL), Code::ArrowUp),
        Shortcut::new(Some(Modifiers::CONTROL), Code::ArrowDown),
        Shortcut::new(Some(Modifiers::CONTROL), Code::ArrowLeft),
        Shortcut::new(Some(Modifiers::CONTROL), Code::ArrowRight),
        Shortcut::new(Some(ctrl_shift), Code::ArrowUp),
        Shortcut::new(Some(ctrl_shift), Code::ArrowDown),
        Shortcut::new(Some(ctrl_shift), Code::ArrowLeft),
        Shortcut::new(Some(ctrl_shift), Code::ArrowRight),
    ];

    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    let mut failed = Vec::new();

    for shortcut in shortcuts {
        if let Err(error) = gs.register(shortcut) {
            eprintln!("shortcut {shortcut} not registered: {error}");
            failed.push(format!("{shortcut}"));
        }
    }

    // On Windows, Ctrl+NumpadEnter is often the same OS hotkey as Ctrl+Enter.
    let _ = gs.register(Shortcut::new(Some(Modifiers::CONTROL), Code::NumpadEnter));

    if !failed.is_empty() {
        let _ = app.emit(
            "capture-error",
            serde_json::json!({
                "error": format!(
                    "Could not register shortcuts ({}). Close other InterviewPilot windows and restart.",
                    failed.join(", ")
                )
            }),
        );
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Must be first: block second EXE/MSI/dev instance (two login windows).
    #[cfg(windows)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(main) = app.get_webview_window("main") {
                let _ = stealth::show_window(&main);
                let _ = main.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(hotkey_plugin())
        .manage(AppState {
            click_through: AtomicBool::new(false),
            app_visible: AtomicBool::new(true),
            force_quit: AtomicBool::new(false),
            overlay_open: AtomicBool::new(false),
            overlay_compact: AtomicBool::new(true),
            overlay_logical_height: Mutex::new(0.0),
            interview_active: AtomicBool::new(false),
            share_fallback_hidden: AtomicBool::new(false),
            audio: AudioEngine::new(),
            prefs: Mutex::new(Prefs::default()),
            last_capture: Mutex::new(None),
            last_capture_at: Mutex::new(None),
            capture_lock: Mutex::new(()),
            last_toggle: Mutex::new(None),
            last_move: Mutex::new(None),
            move_repeat_stop: Mutex::new(None),
            scroll_repeat_stop: Mutex::new(None),
            last_programmatic_move: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            load_prefs,
            save_prefs,
            set_interview_active,
            is_interview_active,
            clear_stored_capture,
            capture_screenshot,
            capture_interview_hotkey,
            show_overlay,
            hide_overlay,
            toggle_overlay,
            set_click_through,
            get_stealth_status,
            audio_status,
            start_system_audio,
            stop_system_audio,
            take_audio_chunk,
            peek_audio_chunk,
            peek_progress_audio_chunk,
            force_take_audio_chunk,
            discard_audio_chunk,
            set_toolbar_window_expanded,
            set_overlay_layout,
            request_solve,
            move_app_windows,
            quit_app,
            load_interview_day,
            load_interview_history,
            append_interview_entry,
            mark_interview_synced,
            list_unsynced_interview_entries
        ])
        .on_window_event(|window, event| {
            if matches!(
                event,
                tauri::WindowEvent::ScaleFactorChanged { .. } | tauri::WindowEvent::Focused(_)
            ) {
                if let Some(webview) = window.app_handle().get_webview_window(window.label()) {
                    let _ = stealth::apply_capture_exclusion(&webview);
                }
            }

            if window.label() != "main" {
                return;
            }
            if !matches!(
                event,
                tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_)
            ) {
                return;
            }
            let app = window.app_handle();
            let Some(state) = app.try_state::<AppState>() else {
                return;
            };
            if state.overlay_open.load(Ordering::SeqCst) && state.app_visible.load(Ordering::SeqCst)
            {
                let skip_sync = state
                    .last_programmatic_move
                    .lock()
                    .ok()
                    .and_then(|last| *last)
                    .is_some_and(|prev| prev.elapsed() < Duration::from_millis(200));
                if !skip_sync {
                    let _ = place_overlay_under_toolbar(&app);
                }
            }
        })
        .setup(|app| {
            // MSI install/reinstall sets ClearSessionOnLaunch (+ deletes session.json).
            // Apply before loading prefs into state so first UI is the login page.
            let prefs =
                session::normalize_prefs(session::apply_fresh_install_session_reset(app.handle()));
            let _ = session::save_prefs(app.handle(), &prefs);
            if let Some(state) = app.try_state::<AppState>() {
                if let Ok(mut slot) = state.prefs.lock() {
                    *slot = prefs.clone();
                }
                activate_auto_stealth(app.handle(), &state);
            }

            if let Some(main) = app.get_webview_window("main") {
                if let Err(error) = stealth::harden_overlay(&main) {
                    eprintln!("[stealth] main harden failed: {error}");
                }
                configure_webview(&main);
                // MSI / no token → first paint is login. Size tall+centered up front so the
                // form isn't clipped inside the 64px toolbar strip before JS expands.
                let needs_login = prefs
                    .token
                    .as_ref()
                    .map(|t| t.trim().is_empty())
                    .unwrap_or(true);
                if needs_login {
                    let _ = main.set_size(tauri::Size::Logical(tauri::LogicalSize::new(
                        LOGIN_LOGICAL_WIDTH,
                        LOGIN_LOGICAL_HEIGHT,
                    )));
                    let _ = place_window_centered(&main);
                } else {
                    let _ = main.set_size(tauri::Size::Logical(tauri::LogicalSize::new(
                        TOOLBAR_LOGICAL_WIDTH,
                        TOOLBAR_CHROME_HEIGHT,
                    )));
                    let _ = place_toolbar_at_top(app.handle());
                }
                let _ = stealth::show_window(&main);
            }
            if let Some(overlay) = app.get_webview_window("overlay") {
                if let Err(error) = stealth::harden_overlay(&overlay) {
                    eprintln!("[stealth] overlay harden failed: {error}");
                }
                configure_webview(&overlay);
                let _ = overlay.hide();
            }

            if let Some(state) = app.try_state::<AppState>() {
                state.app_visible.store(true, Ordering::SeqCst);
                emit_app_visibility(app.handle(), true);
            }

            stealth::protect_all_windows(app.handle());
            stealth::start_capture_guard(app.handle().clone());
            start_screen_share_monitor(app.handle().clone());

            register_hotkeys(app.handle());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building app")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                let Some(state) = app.try_state::<AppState>() else {
                    return;
                };
                if state.force_quit.load(Ordering::SeqCst) {
                    return;
                }
                // Ctrl+B hide: keep process alive (tray-style). Quit sets force_quit.
                if !state.app_visible.load(Ordering::SeqCst) {
                    api.prevent_exit();
                }
            }
        });
}
