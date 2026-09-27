const SEALED_PREFIX: &str = "dpapi:v1:";

pub fn seal_local_secret(value: &str) -> String {
    if value.is_empty() {
        return String::new();
    }
    if value.starts_with(SEALED_PREFIX) {
        return value.to_string();
    }
    #[cfg(windows)]
    {
        match seal_dpapi(value.as_bytes()) {
            Ok(blob) => {
                use base64::Engine as _;
                let encoded = base64::engine::general_purpose::STANDARD.encode(blob);
                return format!("{SEALED_PREFIX}{encoded}");
            }
            Err(_) => return value.to_string(),
        }
    }
    #[cfg(not(windows))]
    {
        value.to_string()
    }
}

pub fn open_local_secret(value: &str) -> String {
    if value.is_empty() {
        return String::new();
    }
    let Some(encoded) = value.strip_prefix(SEALED_PREFIX) else {
        return value.to_string();
    };
    #[cfg(windows)]
    {
        use base64::Engine as _;
        let Ok(blob) = base64::engine::general_purpose::STANDARD.decode(encoded) else {
            return value.to_string();
        };
        match open_dpapi(&blob) {
            Ok(plain) => String::from_utf8(plain).unwrap_or_else(|_| value.to_string()),
            Err(_) => value.to_string(),
        }
    }
    #[cfg(not(windows))]
    {
        let _ = encoded;
        value.to_string()
    }
}

#[cfg(windows)]
fn seal_dpapi(data: &[u8]) -> Result<Vec<u8>, String> {
    use std::ptr::null_mut;
    use windows::Win32::Foundation::{HLOCAL, LocalFree};
    use windows::Win32::Security::Cryptography::{
        CryptProtectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN,
    };

    unsafe {
        let in_blob = CRYPT_INTEGER_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut u8,
        };
        let mut out_blob = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: null_mut(),
        };
        CryptProtectData(
            &in_blob,
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut out_blob,
        )
        .map_err(|e| format!("CryptProtectData: {e}"))?;

        let out =
            std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize).to_vec();
        let _ = LocalFree(Some(HLOCAL(out_blob.pbData as _)));
        Ok(out)
    }
}

#[cfg(windows)]
fn open_dpapi(data: &[u8]) -> Result<Vec<u8>, String> {
    use std::ptr::null_mut;
    use windows::Win32::Foundation::{HLOCAL, LocalFree};
    use windows::Win32::Security::Cryptography::{
        CryptUnprotectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN,
    };

    unsafe {
        let in_blob = CRYPT_INTEGER_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut u8,
        };
        let mut out_blob = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: null_mut(),
        };
        CryptUnprotectData(
            &in_blob,
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut out_blob,
        )
        .map_err(|e| format!("CryptUnprotectData: {e}"))?;

        let out =
            std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize).to_vec();
        let _ = LocalFree(Some(HLOCAL(out_blob.pbData as _)));
        Ok(out)
    }
}
