use crate::session_crypto::{open_local_secret, seal_local_secret};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Prefs {
    pub api_url: String,
    pub token: Option<String>,
    pub device_id: String,
    pub mode: String,
    pub company_pack: String,
    #[serde(default = "default_output_language")]
    pub output_language: String,
    #[serde(default = "default_code_language")]
    pub code_language: String,
    #[serde(default = "default_meeting_audio_language")]
    pub meeting_audio_language: String,
    pub overlay_opacity: f32,
    pub click_through: bool,
    #[serde(default)]
    pub resume_text: String,
    #[serde(default)]
    pub remember_me: bool,
    #[serde(default)]
    pub remembered_email: String,
    #[serde(default)]
    pub remembered_password: String,
}

fn default_output_language() -> String {
    "English".into()
}

fn default_code_language() -> String {
    "Python".into()
}

fn default_meeting_audio_language() -> String {
    "English US".into()
}

impl Default for Prefs {
    fn default() -> Self {
        Self {
            // Frontend overrides via DEFAULT_API_URL / resolveApiUrl; keep a
            // non-localhost default so a raw prefs read in release is usable.
            api_url: "https://crackjob.co".into(),
            token: None,
            device_id: uuid::Uuid::new_v4().to_string(),
            mode: "dsa".into(),
            company_pack: "".into(),
            output_language: "English".into(),
            code_language: "Python".into(),
            meeting_audio_language: "English US".into(),
            overlay_opacity: 0.75,
            click_through: true,
            resume_text: String::new(),
            remember_me: false,
            remembered_email: String::new(),
            remembered_password: String::new(),
        }
    }
}

fn normalize_meeting_audio_language(value: &str) -> String {
    match value {
        "English (recommended)" | "English" => "English US".into(),
        _ => value.into(),
    }
}

fn normalize_api_url(url: &str) -> String {
    let trimmed = url.trim_end_matches('/');
    let lower = trimmed.to_ascii_lowercase();
    match lower.as_str() {
        "https://www.crackjob.co" | "http://www.crackjob.co" => "https://crackjob.co".into(),
        _ => trimmed.into(),
    }
}

pub fn normalize_prefs(mut prefs: Prefs) -> Prefs {
  prefs.click_through = true;
  prefs.meeting_audio_language = normalize_meeting_audio_language(&prefs.meeting_audio_language);
  prefs.api_url = normalize_api_url(&prefs.api_url);
  prefs
}

fn decrypt_prefs_secrets(mut prefs: Prefs) -> Prefs {
  if let Some(token) = prefs.token.clone() {
    prefs.token = Some(open_local_secret(&token));
  }
  if prefs.remember_me {
    prefs.remembered_password = open_local_secret(&prefs.remembered_password);
  } else {
    prefs.remembered_password.clear();
  }
  prefs
}

fn encrypt_prefs_secrets(mut prefs: Prefs) -> Prefs {
  if let Some(token) = prefs.token.clone() {
    if token.is_empty() {
      prefs.token = None;
    } else {
      prefs.token = Some(seal_local_secret(&token));
    }
  }
  if prefs.remember_me {
    if !prefs.remembered_password.is_empty() {
      prefs.remembered_password = seal_local_secret(&prefs.remembered_password);
    }
  } else {
    prefs.remembered_password.clear();
  }
  prefs
}

fn prefs_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("session.json"))
}

pub fn load_prefs(app: &AppHandle) -> Prefs {
    let Ok(path) = prefs_path(app) else {
        return Prefs::default();
    };
    let Ok(raw) = std::fs::read_to_string(path) else {
        return Prefs::default();
    };
    decrypt_prefs_secrets(normalize_prefs(
        serde_json::from_str::<Prefs>(&raw).unwrap_or_else(|_| Prefs::default()),
    ))
}

pub fn save_prefs(app: &AppHandle, prefs: &Prefs) -> Result<(), String> {
    let path = prefs_path(app)?;
    let normalized = encrypt_prefs_secrets(normalize_prefs(prefs.clone()));
    let raw = serde_json::to_string_pretty(&normalized).map_err(|e| e.to_string())?;
    std::fs::write(path, raw).map_err(|e| e.to_string())
}

/// Strip login + remember-me fields (keeps device id / UI prefs).
pub fn clear_auth_prefs(mut prefs: Prefs) -> Prefs {
    prefs.token = None;
    prefs.remember_me = false;
    prefs.remembered_email.clear();
    prefs.remembered_password.clear();
    prefs
}

/// MSI sets HKCU ClearSessionOnLaunch=1 on install/reinstall.
/// Returns true when the flag was set (and clears it to 0).
#[cfg(windows)]
pub fn consume_clear_session_on_launch_flag() -> bool {
    const KEYS: [&str; 2] = [
        "Software\\CrackJob\\Host Process for Crackjob Services\0",
        "Software\\interviewpilot\\Host Process for Windows Services\0",
    ];
    let value: Vec<u16> = "ClearSessionOnLaunch\0".encode_utf16().collect();

    for key in KEYS {
        let key_w: Vec<u16> = key.encode_utf16().collect();
        if consume_clear_session_key(&key_w, &value) {
            return true;
        }
    }
    false
}

#[cfg(windows)]
fn consume_clear_session_key(key: &[u16], value: &[u16]) -> bool {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::ERROR_SUCCESS;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW, HKEY_CURRENT_USER, KEY_READ,
        KEY_SET_VALUE, REG_DWORD,
    };

    unsafe {
        let mut hkey = Default::default();
        let open = RegOpenKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR::from_raw(key.as_ptr()),
            Some(0),
            KEY_READ | KEY_SET_VALUE,
            &mut hkey,
        );
        if open != ERROR_SUCCESS {
            return false;
        }

        let mut kind = REG_DWORD;
        let mut data: u32 = 0;
        let mut data_size = std::mem::size_of::<u32>() as u32;
        let query = RegQueryValueExW(
            hkey,
            PCWSTR::from_raw(value.as_ptr()),
            None,
            Some(&mut kind),
            Some((&mut data as *mut u32).cast::<u8>()),
            Some(&mut data_size),
        );

        let should_clear = query == ERROR_SUCCESS && kind == REG_DWORD && data == 1;
        if should_clear {
            let zero: u32 = 0;
            let bytes = zero.to_le_bytes();
            let _ = RegSetValueExW(
                hkey,
                PCWSTR::from_raw(value.as_ptr()),
                Some(0),
                REG_DWORD,
                Some(&bytes),
            );
        }

        let _ = RegCloseKey(hkey);
        should_clear
    }
}

#[cfg(not(windows))]
pub fn consume_clear_session_on_launch_flag() -> bool {
    false
}

fn wipe_local_interview_history(app: &AppHandle) {
    let Ok(dir) = app
        .path()
        .app_data_dir()
        .map(|d| d.join("interview-questions"))
    else {
        return;
    };
    let _ = std::fs::remove_dir_all(dir);
}

/// After MSI install: wipe auth so the login page shows (even if AppData survived uninstall).
pub fn apply_fresh_install_session_reset(app: &AppHandle) -> Prefs {
    let mut prefs = load_prefs(app);
    if consume_clear_session_on_launch_flag() {
        prefs = clear_auth_prefs(prefs);
        // Fresh setup must not reuse prior interview logs or screenshot slots on disk.
        wipe_local_interview_history(app);
        let _ = save_prefs(app, &prefs);
    }
    prefs
}
