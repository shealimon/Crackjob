use serde::Serialize;
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{LazyLock, Mutex};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

#[cfg(windows)]
static AFFINITY_FAILURE_LOGGED: LazyLock<Mutex<HashSet<String>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));

/// When entire-screen share is active: hide the *system* cursor over Crack
/// windows so Meet/share does not show a floating pointer over "empty" space
/// (WDA already omits the window pixels). Local UI draws its own cursor.
static HIDE_CURSOR_FOR_SHARE: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StealthStatus {
    pub supports_audio: bool,
    pub invisible_in_dock: bool,
    pub invisible_to_screen_share: bool,
    pub invisible_to_tray: bool,
    pub invisible_to_activity_monitor: bool,
    pub click_through: bool,
    pub undetectable_by_browser: bool,
    pub all_active: bool,
    pub platform: String,
    pub capture_protected_windows: u32,
    pub audio_capturing: bool,
    /// System cursor hidden over app; frontend shows local-only cursor.
    pub local_cursor_active: bool,
}

#[cfg(windows)]
fn hwnd_of(window: &WebviewWindow) -> Result<windows::Win32::Foundation::HWND, String> {
    window.hwnd().map_err(|e| format!("hwnd: {e}"))
}

#[cfg(windows)]
fn affinity_target(hwnd: windows::Win32::Foundation::HWND) -> windows::Win32::Foundation::HWND {
    use windows::Win32::UI::WindowsAndMessaging::{GetAncestor, GA_ROOT};

    let root = unsafe { GetAncestor(hwnd, GA_ROOT) };
    if root == windows::Win32::Foundation::HWND::default() {
        hwnd
    } else {
        root
    }
}

#[cfg(windows)]
fn read_display_affinity(hwnd: windows::Win32::Foundation::HWND) -> Option<u32> {
    use windows::Win32::UI::WindowsAndMessaging::GetWindowDisplayAffinity;

    let target = affinity_target(hwnd);
    let mut affinity = 0u32;
    unsafe {
        GetWindowDisplayAffinity(target, &mut affinity)
            .ok()
            .map(|_| affinity)
    }
}

#[cfg(windows)]
fn is_capture_excluded(hwnd: windows::Win32::Foundation::HWND) -> bool {
    use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWINDOWATTRIBUTE};
    use windows::Win32::UI::WindowsAndMessaging::WDA_EXCLUDEFROMCAPTURE;

    const DWMWA_EXCLUDED_FROM_CAPTURE: DWMWINDOWATTRIBUTE = DWMWINDOWATTRIBUTE(18);

    let target = affinity_target(hwnd);
    // Only EXCLUDEFROMCAPTURE counts. WDA_MONITOR paints a black rectangle in
    // Meet/Chrome share — that is NOT the product behavior we want.
    if read_display_affinity(target) == Some(WDA_EXCLUDEFROMCAPTURE.0) {
        return true;
    }

    let mut excluded: i32 = 0;
    unsafe {
        DwmGetWindowAttribute(
            target,
            DWMWA_EXCLUDED_FROM_CAPTURE,
            &mut excluded as *mut _ as *mut _,
            std::mem::size_of::<i32>() as u32,
        )
        .is_ok()
            && excluded != 0
    }
}

/// If affinity fell back to WDA_MONITOR (black box in share), clear and set EXCLUDE.
#[cfg(windows)]
fn fix_monitor_affinity(hwnd: windows::Win32::Foundation::HWND) -> bool {
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE, WDA_MONITOR, WDA_NONE,
    };

    let target = affinity_target(hwnd);
    let Some(affinity) = read_display_affinity(target) else {
        return false;
    };
    if affinity == WDA_EXCLUDEFROMCAPTURE.0 {
        return true;
    }
    if affinity == WDA_MONITOR.0 || affinity != 0 {
        eprintln!(
            "[stealth] fixing bad display affinity 0x{affinity:x} → WDA_EXCLUDEFROMCAPTURE"
        );
        unsafe {
            let _ = SetWindowDisplayAffinity(target, WDA_NONE);
            let _ = SetWindowDisplayAffinity(target, WDA_EXCLUDEFROMCAPTURE);
        }
    }
    is_capture_excluded(target)
}

#[cfg(windows)]
fn strip_styles_blocking_wda(hwnd: windows::Win32::Foundation::HWND) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, SWP_FRAMECHANGED,
        SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WS_EX_LAYERED,
        WS_EX_NOREDIRECTIONBITMAP, WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT,
    };

    // These styles commonly make SetWindowDisplayAffinity return error 8.
    const BLOCKING: u32 = WS_EX_LAYERED.0
        | WS_EX_TRANSPARENT.0
        | WS_EX_NOREDIRECTIONBITMAP.0
        | WS_EX_TOOLWINDOW.0;

    unsafe {
        let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let cleaned = ex & !BLOCKING;
        if cleaned != ex {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, cleaned as isize);
            let _ = SetWindowPos(
                hwnd,
                Some(HWND::default()),
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
            );
        }
        let ex_after = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        static STRIP_LOGGED: std::sync::atomic::AtomicBool =
            std::sync::atomic::AtomicBool::new(false);
        if !STRIP_LOGGED.swap(true, std::sync::atomic::Ordering::SeqCst) {
            eprintln!(
                "[stealth] WDA style strip: before=0x{ex:x} after=0x{ex_after:x}"
            );
        }
    }
}

#[cfg(windows)]
fn reassert_affinity_only(hwnd: windows::Win32::Foundation::HWND) -> bool {
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE,
    };

    let target = affinity_target(hwnd);
    if is_capture_excluded(target) {
        return true;
    }
    let ok = unsafe { SetWindowDisplayAffinity(target, WDA_EXCLUDEFROMCAPTURE).is_ok() };
    ok && is_capture_excluded(target)
}

#[cfg(windows)]
fn apply_affinity_to_hwnd(hwnd: windows::Win32::Foundation::HWND) -> Result<(), String> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowDisplayAffinity, SetWindowLongPtrW, GWL_EXSTYLE,
        WDA_EXCLUDEFROMCAPTURE, WS_EX_APPWINDOW, WS_EX_TOOLWINDOW,
    };

    let target = affinity_target(hwnd);
    if target == HWND::default() {
        return Err("invalid hwnd".into());
    }

    if is_capture_excluded(target) {
        return Ok(());
    }

    let _ = apply_dwm_capture_exclusion(target);
    if is_capture_excluded(target) {
        return Ok(());
    }

    // Soft path first — no style strip / SetWindowPos (those flicker the local UI).
    if reassert_affinity_only(target) {
        return Ok(());
    }

    // Hard path only when affinity is missing (startup / after style breakage).
    strip_styles_blocking_wda(target);

    match unsafe { SetWindowDisplayAffinity(target, WDA_EXCLUDEFROMCAPTURE) } {
        Ok(()) => {}
        Err(e) => {
            let ex_now = unsafe { GetWindowLongPtrW(target, GWL_EXSTYLE) as u32 };
            return Err(format!(
                "SetWindowDisplayAffinity failed ({e}, ex_style=0x{ex_now:x})"
            ));
        }
    }

    unsafe {
        let style = GetWindowLongPtrW(target, GWL_EXSTYLE) as u32;
        let disguised = (style | WS_EX_TOOLWINDOW.0) & !WS_EX_APPWINDOW.0;
        SetWindowLongPtrW(target, GWL_EXSTYLE, disguised as isize);
        let _ = SetWindowDisplayAffinity(target, WDA_EXCLUDEFROMCAPTURE);
    }

    if is_capture_excluded(target) {
        static SUCCESS_LOGGED: std::sync::atomic::AtomicBool =
            std::sync::atomic::AtomicBool::new(false);
        if !SUCCESS_LOGGED.swap(true, std::sync::atomic::Ordering::SeqCst) {
            eprintln!(
                "[stealth] WDA_EXCLUDEFROMCAPTURE active — local UI visible, hidden from share"
            );
        }
        Ok(())
    } else if fix_monitor_affinity(target) {
        Ok(())
    } else {
        Err(format!(
            "WDA not verified (affinity={:?}, ex_style=0x{:x})",
            read_display_affinity(target),
            unsafe { GetWindowLongPtrW(target, GWL_EXSTYLE) as u32 }
        ))
    }
}

#[cfg(windows)]
fn apply_dwm_capture_exclusion(hwnd: windows::Win32::Foundation::HWND) -> Result<(), String> {
    use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWINDOWATTRIBUTE};

    // Win11 22H2+ (not available on 22000 → E_INVALIDARG).
    const DWMWA_EXCLUDED_FROM_CAPTURE: DWMWINDOWATTRIBUTE = DWMWINDOWATTRIBUTE(18);

    let target = affinity_target(hwnd);
    // DWM expects a BOOL (4-byte).
    let mut exclude: i32 = 1;
    unsafe {
        DwmSetWindowAttribute(
            target,
            DWMWA_EXCLUDED_FROM_CAPTURE,
            &mut exclude as *mut _ as *const _,
            std::mem::size_of::<i32>() as u32,
        )
        .map_err(|e| format!("DWMWA_EXCLUDED_FROM_CAPTURE failed: {e}"))
    }
}

#[cfg(windows)]
fn clear_dwm_capture_exclusion(hwnd: windows::Win32::Foundation::HWND) {
    use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWINDOWATTRIBUTE};

    const DWMWA_EXCLUDED_FROM_CAPTURE: DWMWINDOWATTRIBUTE = DWMWINDOWATTRIBUTE(18);

    let target = affinity_target(hwnd);
    let mut exclude: i32 = 0;
    unsafe {
        let _ = DwmSetWindowAttribute(
            target,
            DWMWA_EXCLUDED_FROM_CAPTURE,
            &mut exclude as *mut _ as *const _,
            std::mem::size_of::<i32>() as u32,
        );
    }
}

#[cfg(windows)]
fn refresh_webview_transparency(window: &WebviewWindow) {
    // Opaque host windows: do NOT set A=0 — that pushes WebView2 into a
    // composition path that often breaks SetWindowDisplayAffinity (same API
    // Electron's setContentProtection uses).
    let _ = window.with_webview(|webview| {
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            COREWEBVIEW2_COLOR, ICoreWebView2Controller2,
        };
        use windows::core::Interface;

        unsafe {
            let Ok(controller) = webview.controller().cast::<ICoreWebView2Controller2>() else {
                return;
            };
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

#[cfg(not(windows))]
fn refresh_webview_transparency(_window: &WebviewWindow) {}

/// Exclude windows from screen-share capture while keeping them visible locally.
/// Default ON (product requirement). Set `CRACK_ALLOW_CAPTURE=1` to disable
/// (e.g. so Cursor/`tauri dev` screenshots can see the UI).
fn capture_exclusion_enabled() -> bool {
    !std::env::var_os("CRACK_ALLOW_CAPTURE").is_some_and(|v| v == "1")
}

#[cfg(windows)]
fn clear_affinity_on_hwnd(hwnd: windows::Win32::Foundation::HWND) -> Result<(), String> {
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowDisplayAffinity, WDA_NONE,
    };

    let target = affinity_target(hwnd);
    clear_dwm_capture_exclusion(hwnd);
    unsafe {
        SetWindowDisplayAffinity(target, WDA_NONE)
            .map_err(|e| format!("clear WDA failed: {e}"))?;
        if target != hwnd {
            let _ = SetWindowDisplayAffinity(hwnd, WDA_NONE);
        }
    }
    Ok(())
}

#[cfg(windows)]
fn protect_hwnd_tree(hwnd: windows::Win32::Foundation::HWND) -> Result<(), String> {
    let root = affinity_target(hwnd);
    match apply_affinity_to_hwnd(root) {
        Ok(()) => Ok(()),
        Err(root_err) if root != hwnd => {
            apply_affinity_to_hwnd(hwnd).map_err(|e| format!("{root_err}; hwnd retry: {e}"))
        }
        Err(e) => Err(e),
    }
}

/// Apply capture exclusion to every top-level window owned by this process.
#[cfg(windows)]
fn protect_process_top_level_windows() {
    use windows::Win32::Foundation::{LPARAM, HWND};
    use windows::Win32::System::Threading::GetCurrentProcessId;
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowThreadProcessId, IsWindowVisible,
    };

    struct Scan {
        pid: u32,
    }

    unsafe extern "system" fn each(
        hwnd: HWND,
        lparam: LPARAM,
    ) -> windows_core::BOOL {
        let scan = &*(lparam.0 as *const Scan);
        unsafe {
            let mut window_pid = 0u32;
            GetWindowThreadProcessId(hwnd, Some(&mut window_pid));
            if window_pid == scan.pid && IsWindowVisible(hwnd).as_bool() {
                let _ = apply_affinity_to_hwnd(hwnd);
            }
        }
        windows_core::BOOL::from(true)
    }

    let scan = Scan {
        pid: unsafe { GetCurrentProcessId() },
    };
    unsafe {
        let _ = EnumWindows(Some(each), LPARAM(&scan as *const _ as isize));
    }
}

#[cfg(not(windows))]
fn protect_process_top_level_windows() {}

/// Clear WDA / contentProtected so the window appears in system screenshots.
pub fn clear_capture_exclusion(window: &WebviewWindow) -> Result<(), String> {
    #[cfg(windows)]
    {
        if let Ok(hwnd) = hwnd_of(window) {
            clear_affinity_on_hwnd(hwnd)?;
        }
    }
    let _ = window.set_content_protected(false);
    refresh_webview_transparency(window);
    Ok(())
}

/// Visible locally, omitted from entire-screen / screen-share capture (WDA).
/// Disabled only when `CRACK_ALLOW_CAPTURE=1`.
pub fn apply_capture_exclusion(window: &WebviewWindow) -> Result<(), String> {
    if !capture_exclusion_enabled() {
        return clear_capture_exclusion(window);
    }

    let mut wda_ok = true;
    #[cfg(windows)]
    {
        if let Ok(hwnd) = hwnd_of(window) {
            if let Err(error) = protect_hwnd_tree(hwnd) {
                wda_ok = false;
                log_affinity_failure_once(window.label(), &error);
            }
        }
    }

    let content_ok = window.set_content_protected(true).is_ok();

    #[cfg(windows)]
    {
        if let Ok(hwnd) = hwnd_of(window) {
            if let Err(error) = protect_hwnd_tree(hwnd) {
                wda_ok = false;
                log_affinity_failure_once(window.label(), &error);
            }
        }
    }

    if wda_ok || content_ok {
        Ok(())
    } else {
        Err("capture exclusion unavailable (WDA and contentProtected both failed)".into())
    }
}

#[cfg(windows)]
fn log_affinity_failure_once(label: &str, error: &str) {
    let mut logged = AFFINITY_FAILURE_LOGGED.lock().unwrap_or_else(|e| e.into_inner());
    if logged.insert(label.to_string()) {
        eprintln!("[stealth] exclude '{label}' failed: {error}");
    }
}

/// Soft reinforce: SetWindowDisplayAffinity only — no style strip (no local flicker).
pub fn reassert_capture_exclusion(app: &AppHandle) {
    if !capture_exclusion_enabled() {
        return;
    }
    for label in ["main", "overlay"] {
        let Some(window) = app.get_webview_window(label) else {
            continue;
        };
        let _ = window.set_content_protected(true);
        #[cfg(windows)]
        {
            if let Ok(hwnd) = hwnd_of(&window) {
                if !fix_monitor_affinity(hwnd) {
                    let _ = reassert_affinity_only(hwnd);
                    let _ = fix_monitor_affinity(hwnd);
                }
            }
        }
    }
    apply_stealth_cursor_visibility(app);
}

fn local_cursor_active() -> bool {
    HIDE_CURSOR_FOR_SHARE.load(Ordering::SeqCst) && capture_exclusion_enabled()
}

/// Hide OS cursor over main/overlay while entire-screen share is detected.
/// Does not change WDA / cloak — only cursor visibility inside our windows.
pub fn set_hide_cursor_during_share(app: &AppHandle, hide: bool) {
    let prev = HIDE_CURSOR_FOR_SHARE.swap(hide, Ordering::SeqCst);
    apply_stealth_cursor_visibility(app);
    if prev != hide {
        let active = local_cursor_active();
        eprintln!("[stealth] share cursor hide={active} (local-only pointer)");
        let _ = app.emit(
            "stealth-local-cursor",
            serde_json::json!({ "active": active }),
        );
    }
}

fn apply_stealth_cursor_visibility(app: &AppHandle) {
    let hide = local_cursor_active();
    for label in ["main", "overlay"] {
        let Some(window) = app.get_webview_window(label) else {
            continue;
        };
        // Windows: cursor hidden only while pointer is inside this window.
        let _ = window.set_cursor_visible(!hide);
    }
}

pub fn protect_all_windows(app: &AppHandle) {
    protect_all_windows_inner(app, false);
}

fn protect_all_windows_inner(app: &AppHandle, force: bool) {
    for label in ["main", "overlay"] {
        let Some(window) = app.get_webview_window(label) else {
            continue;
        };
        if !capture_exclusion_enabled() {
            let _ = clear_capture_exclusion(&window);
            continue;
        }
        if !force && verify_capture_protection(&window) {
            continue;
        }
        // Never clear-then-reapply in a loop — clearing creates a capture gap Meet can use.
        if let Err(error) = apply_capture_exclusion(&window) {
            log_affinity_failure_once(window.label(), &error);
        }
    }
    if capture_exclusion_enabled() {
        protect_process_top_level_windows();
    }
    apply_stealth_cursor_visibility(app);
}

pub fn start_capture_guard(app: AppHandle) {
    if !capture_exclusion_enabled() {
        eprintln!(
            "[stealth] capture exclusion OFF (CRACK_ALLOW_CAPTURE=1) — windows visible in share/screenshots"
        );
        protect_all_windows(&app);
        return;
    }
    eprintln!(
        "[stealth] capture exclusion ON — local UI visible, excluded from screen share"
    );
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_millis(800));
            let handle = app.clone();
            let _ = app.run_on_main_thread(move || {
                protect_all_windows(&handle);
            });
        }
    });
}

/// Active entire-screen share indicators (Meet/Chrome/Edge/Teams/Zoom UI text).
/// Keep these specific to full-screen share — do NOT match "sharing a tab/window"
/// or generic "Stop sharing", or tab/window shares would hide the local UI.
#[cfg(windows)]
const ACTIVE_SHARE_MARKERS: &[&str] = &[
    "sharing your screen",
    "is sharing your screen",
    "you are sharing your screen",
    "you're sharing your screen",
    "presenting your screen",
    "your screen is being shared",
    "you are sharing screen",
];

/// Browser/meeting hosts whose child HWND titles may carry share status.
#[cfg(windows)]
const SHARE_HOST_EXES: &[&str] = &[
    "chrome.exe",
    "msedge.exe",
    "brave.exe",
    "chromium.exe",
    "firefox.exe",
    "opera.exe",
    "teams.exe",
    "ms-teams.exe",
    "zoom.exe",
];

#[cfg(windows)]
fn title_matches_active_share(title: &str) -> bool {
    let lower = title.to_lowercase();
    // Prefer entire-screen phrasing; avoid matching "sharing a tab/window" alone
    // unless it is clearly a full-screen share indicator.
    ACTIVE_SHARE_MARKERS.iter().any(|m| lower.contains(m))
}

#[cfg(windows)]
fn is_share_host_process(path_lower: &str) -> bool {
    SHARE_HOST_EXES.iter().any(|exe| path_lower.ends_with(exe))
}

#[cfg(windows)]
pub fn is_active_screen_share() -> bool {
    use windows::Win32::Foundation::{LPARAM, MAX_PATH};
    use windows::Win32::System::Threading::{
        GetCurrentProcessId, OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumChildWindows, EnumWindows, GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible,
    };

    struct Scan {
        found: bool,
        our_pid: u32,
    }

    unsafe extern "system" fn scan_child(
        hwnd: windows::Win32::Foundation::HWND,
        lparam: windows::Win32::Foundation::LPARAM,
    ) -> windows_core::BOOL {
        let scan = &mut *(lparam.0 as *mut Scan);
        if scan.found {
            return windows_core::BOOL::from(false);
        }

        unsafe {
            let mut buffer = [0u16; 512];
            let len = GetWindowTextW(hwnd, &mut buffer);
            if len > 0 {
                let title = String::from_utf16_lossy(&buffer[..len as usize]);
                if title_matches_active_share(&title) {
                    scan.found = true;
                    return windows_core::BOOL::from(false);
                }
            }
        }
        windows_core::BOOL::from(true)
    }

    unsafe extern "system" fn scan_top_level(
        hwnd: windows::Win32::Foundation::HWND,
        lparam: windows::Win32::Foundation::LPARAM,
    ) -> windows_core::BOOL {
        let scan = &mut *(lparam.0 as *mut Scan);
        if scan.found {
            return windows_core::BOOL::from(false);
        }

        unsafe {
            if !IsWindowVisible(hwnd).as_bool() {
                return windows_core::BOOL::from(true);
            }

            let mut window_pid = 0u32;
            GetWindowThreadProcessId(hwnd, Some(&mut window_pid));
            if window_pid == scan.our_pid {
                return windows_core::BOOL::from(true);
            }

            let mut buffer = [0u16; 512];
            let len = GetWindowTextW(hwnd, &mut buffer);
            if len > 0 {
                let title = String::from_utf16_lossy(&buffer[..len as usize]);
                if title_matches_active_share(&title) {
                    scan.found = true;
                    return windows_core::BOOL::from(false);
                }
            }

            let mut is_share_host = false;
            if let Ok(process) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, window_pid) {
                let mut path_buf = [0u16; MAX_PATH as usize];
                let mut path_len = path_buf.len() as u32;
                if QueryFullProcessImageNameW(
                    process,
                    PROCESS_NAME_WIN32,
                    windows::core::PWSTR(path_buf.as_mut_ptr()),
                    &mut path_len,
                )
                .is_ok()
                {
                    let path = String::from_utf16_lossy(&path_buf[..path_len as usize]);
                    is_share_host = is_share_host_process(&path.to_lowercase());
                }
            }

            if is_share_host {
                let _ = EnumChildWindows(Some(hwnd), Some(scan_child), LPARAM(scan as *mut _ as isize));
                if scan.found {
                    return windows_core::BOOL::from(false);
                }
            }
        }

        windows_core::BOOL::from(true)
    }

    let mut scan = Scan {
        found: false,
        our_pid: unsafe { GetCurrentProcessId() },
    };

    unsafe {
        let _ = EnumWindows(Some(scan_top_level), LPARAM(&mut scan as *mut _ as isize));
    }
    scan.found
}

#[cfg(not(windows))]
pub fn is_active_screen_share() -> bool {
    false
}

pub fn harden_overlay(window: &WebviewWindow) -> Result<(), String> {
    window
        .set_always_on_top(true)
        .map_err(|e| e.to_string())?;
    window
        .set_skip_taskbar(true)
        .map_err(|e| e.to_string())?;
    window.set_decorations(false).map_err(|e| e.to_string())?;
    // Apply capture exclusion before TOOLWINDOW disguise when possible.
    let _ = apply_capture_exclusion(window);
    disguise_window(window)?;
    // Square corners — Win11 default round leaves black host pixels at edges.
    let _ = apply_square_corners(window);
    apply_capture_exclusion(window)
}

/// Force sharp corners so opaque host color never peeks through a DWM curve.
#[cfg(windows)]
fn apply_square_corners(window: &WebviewWindow) -> Result<(), String> {
    use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWINDOWATTRIBUTE};

    // DWMWA_WINDOW_CORNER_PREFERENCE = 33; DWMWCP_DONOTROUND = 1
    const DWMWA_WINDOW_CORNER_PREFERENCE: DWMWINDOWATTRIBUTE = DWMWINDOWATTRIBUTE(33);
    const DWMWCP_DONOTROUND: i32 = 1;

    let hwnd = affinity_target(hwnd_of(window)?);
    let mut preference = DWMWCP_DONOTROUND;
    unsafe {
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            &mut preference as *mut i32 as *mut _,
            std::mem::size_of::<i32>() as u32,
        )
        .map_err(|e| format!("DWM square corners failed: {e}"))
    }
}

#[cfg(not(windows))]
fn apply_square_corners(_window: &WebviewWindow) -> Result<(), String> {
    Ok(())
}

pub fn hide_window(window: &WebviewWindow) -> Result<(), String> {
    // SW_HIDE after WDA_EXCLUDEFROMCAPTURE makes Chromium/Meet paint a black
    // rectangle of the window shape on re-show. Cloak instead — local hide,
    // capture exclusion stays healthy.
    #[cfg(windows)]
    {
        if capture_exclusion_enabled() {
            match set_window_cloaked(window, true) {
                Ok(()) => {
                    eprintln!("[stealth] Ctrl+B hide via DWM cloak (no SW_HIDE)");
                    return Ok(());
                }
                Err(e) => eprintln!("[stealth] cloak hide failed ({e}), falling back to hide()"),
            }
        }
    }
    window.hide().map_err(|e| e.to_string())
}

pub fn show_window(window: &WebviewWindow) -> Result<(), String> {
    let _ = window.unminimize();
    let _ = window.set_always_on_top(true);
    let _ = window.set_skip_taskbar(true);

    #[cfg(windows)]
    {
        if capture_exclusion_enabled() {
            // Uncloak first (no SW_HIDE cycle). Then ensure EXCLUDE — never MONITOR.
            let _ = set_window_cloaked(window, false);
            let _ = window.show();
            let _ = disguise_window(window);
            let _ = apply_square_corners(window);
            refresh_webview_transparency(window);
            if let Ok(hwnd) = hwnd_of(window) {
                // Full clean re-apply: NONE → strip → EXCLUDE (kills black-box state).
                restore_exclude_affinity(hwnd);
                eprintln!(
                    "[stealth] Ctrl+B show — affinity={:?}",
                    read_display_affinity(hwnd)
                );
            }
            let _ = window.set_content_protected(true);
            if let Ok(hwnd) = hwnd_of(window) {
                let _ = restore_exclude_affinity(hwnd);
            }
            return Ok(());
        }
    }

    window.show().map_err(|e| e.to_string())?;
    let _ = disguise_window(window);
    refresh_webview_transparency(window);
    let _ = apply_capture_exclusion(window);
    Ok(())
}

/// Strip blocking styles and ensure WDA_EXCLUDEFROMCAPTURE (never leave MONITOR).
#[cfg(windows)]
fn restore_exclude_affinity(hwnd: windows::Win32::Foundation::HWND) {
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE, WDA_MONITOR, WDA_NONE,
    };

    let target = affinity_target(hwnd);
    strip_styles_blocking_wda(target);

    if let Some(aff) = read_display_affinity(target) {
        if aff == WDA_EXCLUDEFROMCAPTURE.0 {
            return;
        }
        if aff == WDA_MONITOR.0 {
            eprintln!("[stealth] clearing WDA_MONITOR (black-box) → EXCLUDE");
            unsafe {
                let _ = SetWindowDisplayAffinity(target, WDA_NONE);
            }
        }
    }

    unsafe {
        let _ = SetWindowDisplayAffinity(target, WDA_EXCLUDEFROMCAPTURE);
    }
    let _ = apply_dwm_capture_exclusion(target);

    if read_display_affinity(target) == Some(WDA_MONITOR.0) {
        eprintln!("[stealth] EXCLUDE fell back to MONITOR — clearing affinity entirely");
        unsafe {
            let _ = SetWindowDisplayAffinity(target, WDA_NONE);
        }
    }
}

#[cfg(windows)]
fn set_window_cloaked(window: &WebviewWindow, cloak: bool) -> Result<(), String> {
    use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWINDOWATTRIBUTE};

    const DWMWA_CLOAK: DWMWINDOWATTRIBUTE = DWMWINDOWATTRIBUTE(13);

    let hwnd = hwnd_of(window)?;
    let target = affinity_target(hwnd);
    let mut value: i32 = if cloak { 1 } else { 0 };
    unsafe {
        DwmSetWindowAttribute(
            target,
            DWMWA_CLOAK,
            &mut value as *mut _ as *const _,
            std::mem::size_of::<i32>() as u32,
        )
        .map_err(|e| format!("DWMWA_CLOAK failed: {e}"))
    }
}

#[cfg(windows)]
pub fn disguise_window(window: &WebviewWindow) -> Result<(), String> {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowTextW, GWL_EXSTYLE, WS_EX_APPWINDOW,
        WS_EX_TOOLWINDOW,
    };

    window.set_title("").map_err(|e| e.to_string())?;

    let hwnd = hwnd_of(window)?;
    unsafe {
        let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let disguised = (style | WS_EX_TOOLWINDOW.0) & !WS_EX_APPWINDOW.0;
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, disguised as isize);
        let _ = SetWindowTextW(hwnd, windows_core::w!(""));
    }
    if capture_exclusion_enabled() {
        restore_exclude_affinity(hwnd);
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn disguise_window(window: &WebviewWindow) -> Result<(), String> {
    window.set_title("").map_err(|e| e.to_string())
}

#[cfg(windows)]
pub fn verify_capture_protection(window: &WebviewWindow) -> bool {
    hwnd_of(window)
        .map(|hwnd| is_capture_excluded(hwnd))
        .unwrap_or(false)
}

#[cfg(not(windows))]
pub fn verify_capture_protection(window: &WebviewWindow) -> bool {
    false
}

pub fn collect_stealth_status(
    app: &AppHandle,
    click_through: bool,
    audio_available: bool,
    audio_capturing: bool,
    manually_hidden: bool,
    share_fallback_hidden: bool,
) -> StealthStatus {
    let mut capture_protected_windows = 0u32;
    for label in ["main", "overlay"] {
        let Some(window) = app.get_webview_window(label) else {
            continue;
        };
        if window.is_visible().unwrap_or(false) && verify_capture_protection(&window) {
            capture_protected_windows += 1;
        }
    }

    let invisible_to_screen_share =
        manually_hidden || share_fallback_hidden || capture_protected_windows > 0;

    #[cfg(windows)]
    let platform = "windows".to_string();
    #[cfg(target_os = "macos")]
    let platform = "macos".to_string();
    #[cfg(not(any(windows, target_os = "macos")))]
    let platform = "other".to_string();

    let invisible_in_dock = true;

    let invisible_to_activity_monitor = app
        .get_webview_window("main")
        .and_then(|window| window.title().ok())
        .map(|title| title.is_empty())
        .unwrap_or(true);

    let invisible_to_tray = true;
    let supports_audio = audio_available;
    let undetectable_by_browser = true;

    let all_active = supports_audio
        && invisible_in_dock
        && invisible_to_screen_share
        && invisible_to_tray
        && invisible_to_activity_monitor
        && click_through
        && undetectable_by_browser;

    StealthStatus {
        supports_audio,
        invisible_in_dock,
        invisible_to_screen_share,
        invisible_to_tray,
        invisible_to_activity_monitor,
        click_through,
        undetectable_by_browser,
        all_active,
        platform,
        capture_protected_windows,
        audio_capturing,
        local_cursor_active: local_cursor_active(),
    }
}

pub fn apply_auto_stealth(app: &AppHandle) {
    for label in ["main", "overlay"] {
        let Some(window) = app.get_webview_window(label) else {
            continue;
        };
        if let Err(error) = disguise_window(&window) {
            eprintln!("[stealth] auto disguise failed for '{label}': {error}");
        }
    }

    protect_all_windows(app);

    if let Some(overlay) = app.get_webview_window("overlay") {
        if let Err(error) = overlay.set_ignore_cursor_events(false) {
            eprintln!("[stealth] overlay click-through disabled: {error}");
        }
    }
}
