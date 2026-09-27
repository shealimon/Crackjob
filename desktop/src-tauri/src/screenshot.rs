use crate::stealth;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::codecs::jpeg::JpegEncoder;
use image::{imageops, imageops::FilterType, DynamicImage, ExtendedColorType, RgbaImage};
use std::io::Cursor;
use tauri::AppHandle;
use xcap::{Monitor, Window};

/// Keep screenshots readable for vision — 1280px so statements/code stay sharp.
/// Triangle + q75 is much faster than Lanczos3/q80 with negligible OCR loss.
const MAX_WIDTH: u32 = 1280;
const JPEG_QUALITY: u8 = 75;
/// Interview surfaces need both axes. Area-only let the taskbar (~1920×50) win
/// z-order after Crack, so vision saw no question ("No interview is visible").
const MIN_TARGET_WIDTH: u32 = 480;
const MIN_TARGET_HEIGHT: u32 = 300;

pub struct PreparedImage {
    pub base64: String,
    pub mime_type: String,
}

fn resize_for_vision(image: RgbaImage) -> DynamicImage {
    let (w, h) = (image.width(), image.height());
    if w <= MAX_WIDTH {
        return DynamicImage::ImageRgba8(image);
    }
    let new_h = ((u64::from(h) * u64::from(MAX_WIDTH)) / u64::from(w)).max(1) as u32;
    DynamicImage::ImageRgba8(imageops::resize(
        &image,
        MAX_WIDTH,
        new_h,
        FilterType::Triangle,
    ))
}

fn encode_jpeg_base64(image: DynamicImage) -> Result<String, String> {
    let rgb = image.into_rgb8();
    let mut buf = Cursor::new(Vec::with_capacity((rgb.width() * rgb.height() / 4) as usize));
    let mut encoder = JpegEncoder::new_with_quality(&mut buf, JPEG_QUALITY);
    encoder
        .encode(rgb.as_raw(), rgb.width(), rgb.height(), ExtendedColorType::Rgb8)
        .map_err(|e| format!("Could not encode screenshot: {e}"))?;
    Ok(STANDARD.encode(buf.into_inner()))
}

fn prepare_for_api(image: RgbaImage) -> Result<PreparedImage, String> {
    let resized = resize_for_vision(image);
    Ok(PreparedImage {
        base64: encode_jpeg_base64(resized)?,
        mime_type: "image/jpeg".into(),
    })
}

fn is_crack_window(window: &Window) -> bool {
    window.pid().ok() == Some(std::process::id())
}

#[cfg(debug_assertions)]
#[cfg(debug_assertions)]
fn window_area(window: &Window) -> u64 {
    let w = u64::from(window.width().unwrap_or(0));
    let h = u64::from(window.height().unwrap_or(0));
    w.saturating_mul(h)
}

fn window_app_lower(window: &Window) -> String {
    window.app_name().unwrap_or_default().to_lowercase()
}

/// Taskbar, desktop wallpaper, Start/search flyouts — not the interview page.
fn is_shell_chrome(window: &Window) -> bool {
    let app = window_app_lower(window);
    let title = window.title().unwrap_or_default();
    let height = window.height().unwrap_or(0);
    let width = window.width().unwrap_or(0);

    let explorer = app.contains("explorer");
    if explorer && (title.trim().is_empty() || height < MIN_TARGET_HEIGHT || width < MIN_TARGET_WIDTH)
    {
        return true;
    }

    const JUNK: &[&str] = &[
        "shell experience",
        "searchapp",
        "searchui",
        "startmenuexperiencehost",
        "textinputhost",
        "lockapp",
        "windows start experience",
    ];
    JUNK.iter().any(|needle| app.contains(needle))
}

fn usable_target(window: &Window) -> bool {
    if is_crack_window(window) || is_shell_chrome(window) {
        return false;
    }
    if window.is_minimized().unwrap_or(true) {
        return false;
    }
    let width = window.width().unwrap_or(0);
    let height = window.height().unwrap_or(0);
    width >= MIN_TARGET_WIDTH && height >= MIN_TARGET_HEIGHT
}

#[cfg(debug_assertions)]
fn debug_window_label(window: &Window) -> String {
    let title = window.title().unwrap_or_default();
    let title = if title.chars().count() > 48 {
        format!("{}…", title.chars().take(48).collect::<String>())
    } else {
        title
    };
    format!(
        "pid={:?} app={} {}x{} title={:?}",
        window.pid().ok(),
        window.app_name().unwrap_or_default(),
        window.width().unwrap_or(0),
        window.height().unwrap_or(0),
        title
    )
}

/// Capture the interview page window (Chrome/IDE/etc.), not the full desktop.
///
/// Full-monitor capture + WDA exclusion paints Crack as a solid black rectangle
/// (especially on Windows builds before 2004, where EXCLUDEFROMCAPTURE falls back
/// to WDA_MONITOR). Window capture reads that HWND's own pixels, so the overlay
/// can stay visible while vision still sees the question underneath.
///
/// Target order matters: Ctrl+H often focuses Crack, so `is_focused` is false on
/// the interview app. Picking the *largest* window then grabs a background Chrome
/// (e.g. Google account picker) instead of the Notepad++/IDE in front. Prefer
/// z-order: `Window::all()` is front-to-back (EnumWindows), skip Crack *and*
/// shell chrome (taskbar/desktop), take the first interview-sized window.
fn capture_window_target() -> Result<RgbaImage, String> {
    let windows = Window::all().map_err(|e| format!("No windows: {e}"))?;

    if let Some(focused) = windows.iter().find(|w| {
        w.is_focused().unwrap_or(false) && usable_target(w)
    }) {
        if let Ok(image) = focused.capture_image() {
            #[cfg(debug_assertions)]
            eprintln!("[screenshot] focused {}", debug_window_label(focused));
            return Ok(image);
        }
    }

    // Topmost usable non-Crack window (front-to-back), not largest-by-area.
    for window in &windows {
        if !usable_target(window) {
            continue;
        }
        if let Ok(image) = window.capture_image() {
            #[cfg(debug_assertions)]
            eprintln!(
                "[screenshot] topmost {} area={}",
                debug_window_label(window),
                window_area(window)
            );
            return Ok(image);
        }
    }

    Err("No capture target".into())
}

fn capture_monitor_fallback() -> Result<RgbaImage, String> {
    #[cfg(debug_assertions)]
    eprintln!("[screenshot] falling back to full monitor capture");
    let monitors = Monitor::all().map_err(|e| format!("No monitors: {e}"))?;
    let monitor = monitors
        .into_iter()
        .next()
        .ok_or_else(|| "No monitor found".to_string())?;
    monitor
        .capture_image()
        .map_err(|e| format!("Screenshot failed: {e}"))
}

/// Capture interview content without hiding Crack windows.
/// Prefers the focused/topmost non-Crack window so WDA black-fill never covers
/// the question. Window capture never includes Crack (xcap skips this pid);
/// WDA is already held by the share-guard loop — do not EnumWindows twice here.
/// LOCKED: Callers must NOT hide_window before calling this (Ctrl+H UX).
pub fn capture_primary_for_api(app: &AppHandle) -> Result<PreparedImage, String> {
    let image = match capture_window_target() {
        Ok(image) => image,
        Err(_) => {
            // Monitor fallback can paint Crack unless exclusion is asserted.
            stealth::protect_all_windows(app);
            capture_monitor_fallback()?
        }
    };
    prepare_for_api(image)
}
