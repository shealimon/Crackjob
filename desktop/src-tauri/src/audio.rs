use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::Serialize;
use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc, Mutex,
};
use std::thread;
use std::time::Duration;

const MAX_BUFFER_SECS: u32 = 52;
/// WASAPI loopback hiss sits well below this. The old 0.00035 floor treated
/// residual speaker noise as speech, so a 1–2s question stayed "open" ~15s.
/// Quiet Chrome/Translate TTS often sits ~0.0015–0.003 RMS. 0.004 was deaf; 0.0025
/// still missed some speaker playback — 0.0018 keeps hiss out while catching TTS.
const SPEECH_RMS_THRESHOLD: f32 = 0.0018;
const SPEECH_PEAK_THRESHOLD: f32 = 0.006;
/// After real speech, drop below this fraction of peak RMS = pause (TTS tail / hiss).
const TRAILING_SILENCE_RATIO: f32 = 0.18;
const FRAME_MS: u32 = 20;
const PRE_ROLL_MS: u32 = 80;
const POST_ROLL_MS: u32 = 40;
/// Long spoken prompts (Translate / interviewer reading) need one coherent clip.
/// 8s forced mid-problem splits → slow STT per fragment + broken merge → no answer.
const MAX_UTTERANCE_MS: u32 = 45_000;

/// How long a pause must last before we treat speech as "ended".
/// Short Qs need enough silence that a breath between words ("args" … "and kwargs")
/// does not split the question into a truncated clip.
fn silence_end_ms(speech_ms: u32) -> u32 {
    if speech_ms < 2_200 {
        280
    } else if speech_ms < 7_000 {
        400
    } else {
        560
    }
}

fn peek_silence_ms(speech_ms: u32) -> u32 {
    silence_end_ms(speech_ms).saturating_sub(80).max(120)
}

struct UtteranceBounds {
    speech_at: usize,
    last_speech_end: usize,
    trailing_silence_ms: u32,
}

#[derive(Debug, Clone, Copy)]
struct AudioFormat {
    sample_rate: u32,
    channels: u16,
    block_align: u16,
    bits_per_sample: u16,
    is_float: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioStatus {
    pub available: bool,
    pub capturing: bool,
    pub speaking: bool,
    pub backend: String,
    pub frames: u64,
    pub buffered_ms: u32,
    pub note: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioChunk {
    pub audio_base64: String,
    pub duration_ms: u32,
    pub sample_rate: u32,
}

#[derive(Clone)]
pub struct AudioEngine {
    stop: Arc<AtomicBool>,
    capturing: Arc<AtomicBool>,
    frames: Arc<AtomicU64>,
    error: Arc<Mutex<Option<String>>>,
    pcm: Arc<Mutex<Vec<u8>>>,
    format: Arc<Mutex<Option<AudioFormat>>>,
    backend: Arc<Mutex<String>>,
}

impl AudioEngine {
    pub fn new() -> Self {
        Self {
            stop: Arc::new(AtomicBool::new(false)),
            capturing: Arc::new(AtomicBool::new(false)),
            frames: Arc::new(AtomicU64::new(0)),
            error: Arc::new(Mutex::new(None)),
            pcm: Arc::new(Mutex::new(Vec::new())),
            format: Arc::new(Mutex::new(None)),
            backend: Arc::new(Mutex::new("idle".into())),
        }
    }

    fn buffered_ms(&self) -> u32 {
        let format = self.format.lock().ok().and_then(|slot| *slot);
        let pcm_len = self.pcm.lock().ok().map(|buf| buf.len()).unwrap_or(0);
        let Some(format) = format else {
            return 0;
        };
        if format.sample_rate == 0 || format.block_align == 0 {
            return 0;
        }
        let bytes_per_sec = format.sample_rate as u64 * format.block_align as u64;
        ((pcm_len as u64 * 1000) / bytes_per_sec) as u32
    }

    pub fn status(&self) -> AudioStatus {
        AudioStatus {
            available: cfg!(windows),
            capturing: self.capturing.load(Ordering::SeqCst),
            speaking: self.is_speaking_now(),
            backend: self
                .backend
                .lock()
                .ok()
                .map(|name| name.clone())
                .unwrap_or_else(|| "idle".into()),
            frames: self.frames.load(Ordering::SeqCst),
            buffered_ms: self.buffered_ms(),
            note: "Captures whatever plays through your speakers or headphones (Chrome, Zoom, Translate, YouTube).".into(),
            error: self.error.lock().ok().and_then(|g| g.clone()),
        }
    }

    /// True while speech is in the buffer — no silence pause required (for UI indicators).
    fn is_speaking_now(&self) -> bool {
        let format = match self.format.lock().ok().and_then(|slot| *slot) {
            Some(format) => format,
            None => return false,
        };
        let pcm = match self.pcm.lock().ok() {
            Some(pcm) => pcm,
            None => return false,
        };
        if pcm.is_empty() {
            return false;
        }

        let frame_bytes = bytes_for_ms(&format, FRAME_MS);
        if frame_bytes == 0 {
            return false;
        }

        if let Some(found) = find_utterance(&pcm, &format, frame_bytes) {
            let speech_ms = pcm_duration_ms(
                found.last_speech_end.saturating_sub(found.speech_at),
                &format,
            );
            if found.trailing_silence_ms < silence_end_ms(speech_ms) {
                return true;
            }
        }

        let tail_frames = 2usize;
        let check_bytes = frame_bytes * tail_frames;
        let start = pcm.len().saturating_sub(check_bytes);
        let tail = &pcm[start..];
        let mut offset = 0usize;
        while offset + frame_bytes <= tail.len() {
            if has_speech(&tail[offset..offset + frame_bytes], &format) {
                return true;
            }
            offset += frame_bytes;
        }

        false
    }

    pub fn start(&self) -> Result<AudioStatus, String> {
        if self.capturing.load(Ordering::SeqCst) {
            return Ok(self.status());
        }
        if !cfg!(windows) {
            return Err("System audio capture is Windows-only (WASAPI).".into());
        }

        self.stop.store(false, Ordering::SeqCst);
        self.frames.store(0, Ordering::SeqCst);
        if let Ok(mut pcm) = self.pcm.lock() {
            pcm.clear();
        }
        if let Ok(mut format) = self.format.lock() {
            *format = None;
        }
        if let Ok(mut backend) = self.backend.lock() {
            *backend = "starting".into();
        }
        if let Ok(mut err) = self.error.lock() {
            *err = None;
        }

        let stop = self.stop.clone();
        let capturing = self.capturing.clone();
        let frames = self.frames.clone();
        let error = self.error.clone();
        let pcm = self.pcm.clone();
        let format_slot = self.format.clone();
        let backend = self.backend.clone();

        capturing.store(true, Ordering::SeqCst);
        thread::Builder::new()
            .name("audio-capture".into())
            .spawn(move || {
                #[cfg(windows)]
                {
                    if let Err(e) = run_capture_orchestrator(&stop, &frames, &pcm, &format_slot, &backend) {
                        if let Ok(mut slot) = error.lock() {
                            *slot = Some(e);
                        }
                    }
                }
                capturing.store(false, Ordering::SeqCst);
            })
            .map_err(|e| e.to_string())?;

        thread::sleep(Duration::from_millis(120));
        Ok(self.status())
    }

    pub fn stop(&self) -> AudioStatus {
        self.stop.store(true, Ordering::SeqCst);
        self.capturing.store(false, Ordering::SeqCst);
        self.status()
    }

    pub fn discard_chunk(&self, min_ms: u32) {
        if min_ms == 0 {
            if let Ok(mut pcm) = self.pcm.lock() {
                pcm.clear();
            }
            return;
        }
        let Some(format) = self.format.lock().ok().and_then(|slot| *slot) else {
            return;
        };
        if format.block_align == 0 || format.sample_rate == 0 {
            return;
        }
        let bytes_per_ms =
            (format.sample_rate as u64 * format.block_align as u64) / 1000;
        let min_bytes = (bytes_per_ms * min_ms as u64) as usize;
        if min_bytes == 0 {
            return;
        }
        let take_bytes = min_bytes - (min_bytes % format.block_align as usize);
        if take_bytes == 0 {
            return;
        }
        if let Ok(mut pcm) = self.pcm.lock() {
            if pcm.len() >= take_bytes {
                pcm.drain(0..take_bytes);
            }
        }
    }

    pub fn take_chunk(&self, min_ms: u32) -> Option<AudioChunk> {
        let format = self.format.lock().ok().and_then(|slot| *slot)?;
        if format.block_align == 0 || format.sample_rate == 0 {
            return None;
        }

        let frame_bytes = bytes_for_ms(&format, FRAME_MS);
        if frame_bytes == 0 {
            return None;
        }

        let chunk_bytes = {
            let mut pcm = self.pcm.lock().ok()?;
            let Some(found) = find_utterance(&pcm, &format, frame_bytes) else {
                trim_leading_silence(&mut pcm, &format);
                return None;
            };

            let pre_roll = bytes_for_ms(&format, PRE_ROLL_MS);
            let take_start = align_bytes(found.speech_at.saturating_sub(pre_roll), format.block_align);
            let mut last_speech_end = found.last_speech_end;
            if take_start > 0 {
                pcm.drain(0..take_start);
                last_speech_end = last_speech_end.saturating_sub(take_start);
            }

            let speech_ms = pcm_duration_ms(last_speech_end, &format);
            let complete = found.trailing_silence_ms >= silence_end_ms(speech_ms);
            let hit_max = speech_ms >= MAX_UTTERANCE_MS;

            // Interviewer is still talking — hold the buffer until they pause.
            if !complete && !hit_max {
                return None;
            }

            let min_speech = min_ms.max(280);
            if complete && speech_ms < min_speech {
                let discard = align_bytes(last_speech_end.min(pcm.len()), format.block_align);
                if discard > 0 {
                    pcm.drain(0..discard);
                }
                return None;
            }

            let post_roll = bytes_for_ms(&format, POST_ROLL_MS);
            let mut take_end = last_speech_end.saturating_add(post_roll).min(pcm.len());
            if hit_max && !complete {
                take_end = bytes_for_ms(&format, MAX_UTTERANCE_MS).min(pcm.len());
            }
            take_end = align_bytes(take_end, format.block_align);
            if take_end == 0 || pcm.len() < take_end {
                return None;
            }
            pcm.drain(0..take_end).collect::<Vec<u8>>()
        };

        encode_chunk(chunk_bytes, &format)
    }

    /// Take the current utterance immediately — even before the silence-end pause.
    /// Used when the user presses Ctrl+Enter (they already know the question finished).
    pub fn force_take_chunk(&self, min_ms: u32) -> Option<AudioChunk> {
        let format = self.format.lock().ok().and_then(|slot| *slot)?;
        if format.block_align == 0 || format.sample_rate == 0 {
            return None;
        }

        let frame_bytes = bytes_for_ms(&format, FRAME_MS);
        if frame_bytes == 0 {
            return None;
        }

        let chunk_bytes = {
            let mut pcm = self.pcm.lock().ok()?;
            let Some(found) = find_utterance(&pcm, &format, frame_bytes) else {
                trim_leading_silence(&mut pcm, &format);
                return None;
            };

            let pre_roll = bytes_for_ms(&format, PRE_ROLL_MS);
            let take_start = align_bytes(found.speech_at.saturating_sub(pre_roll), format.block_align);
            let mut last_speech_end = found.last_speech_end;
            if take_start > 0 {
                pcm.drain(0..take_start);
                last_speech_end = last_speech_end.saturating_sub(take_start);
            }

            let speech_ms = pcm_duration_ms(last_speech_end, &format);
            let min_speech = min_ms.max(200);
            if speech_ms < min_speech {
                return None;
            }

            let post_roll = bytes_for_ms(&format, POST_ROLL_MS.min(found.trailing_silence_ms));
            let mut take_end = last_speech_end.saturating_add(post_roll).min(pcm.len());
            take_end = align_bytes(take_end, format.block_align);
            if take_end == 0 || pcm.len() < take_end {
                return None;
            }
            pcm.drain(0..take_end).collect::<Vec<u8>>()
        };

        encode_chunk(chunk_bytes, &format)
    }

    /// Copy the in-progress utterance once the interviewer has paused, without
    /// consuming it — so Whisper can run during the remaining silence wait.
    pub fn peek_chunk(&self, min_ms: u32) -> Option<AudioChunk> {
        self.peek_internal(min_ms, false)
    }

    /// Mid-speech preview — no silence wait. Lets STT start while the interviewer
    /// is still talking so question text appears on screen sooner.
    pub fn peek_progress_chunk(&self, min_ms: u32) -> Option<AudioChunk> {
        self.peek_internal(min_ms, true)
    }

    fn peek_internal(&self, min_ms: u32, allow_without_silence: bool) -> Option<AudioChunk> {
        let format = self.format.lock().ok().and_then(|slot| *slot)?;
        if format.block_align == 0 || format.sample_rate == 0 {
            return None;
        }

        let frame_bytes = bytes_for_ms(&format, FRAME_MS);
        if frame_bytes == 0 {
            return None;
        }

        let chunk_bytes = {
            let pcm = self.pcm.lock().ok()?;
            let found = find_utterance(&pcm, &format, frame_bytes)?;
            let pre_roll = bytes_for_ms(&format, PRE_ROLL_MS);
            let take_start = align_bytes(found.speech_at.saturating_sub(pre_roll), format.block_align);
            let speech_ms = pcm_duration_ms(found.last_speech_end.saturating_sub(take_start), &format);
            let min_speech = if allow_without_silence {
                min_ms.max(700)
            } else {
                min_ms.max(280)
            };
            if speech_ms < min_speech {
                return None;
            }
            if !allow_without_silence
                && found.trailing_silence_ms < peek_silence_ms(speech_ms)
            {
                return None;
            }

            let post_roll = bytes_for_ms(&format, POST_ROLL_MS.min(found.trailing_silence_ms));
            let take_end = align_bytes(
                found.last_speech_end.saturating_add(post_roll).min(pcm.len()),
                format.block_align,
            );
            if take_end <= take_start {
                return None;
            }
            pcm[take_start..take_end].to_vec()
        };

        encode_chunk(chunk_bytes, &format)
    }
}

fn find_utterance(pcm: &[u8], format: &AudioFormat, frame_bytes: usize) -> Option<UtteranceBounds> {
    if frame_bytes == 0 || pcm.len() < frame_bytes {
        return None;
    }

    let mut speech_start: Option<usize> = None;
    let mut last_speech_end: usize = 0;
    let mut trailing_silence_ms: u32 = 0;
    let mut peak_rms = SPEECH_RMS_THRESHOLD;
    let mut offset = 0usize;

    while offset + frame_bytes <= pcm.len() {
        let (rms, peak) = pcm_levels(&pcm[offset..offset + frame_bytes], format);
        let abs_speech = rms >= SPEECH_RMS_THRESHOLD || peak >= SPEECH_PEAK_THRESHOLD;
        // Once the question is underway, leftover hiss/TTS tail is silence even if
        // it's above a tiny absolute floor — that's what used to keep VAD open 15s.
        let speech = if speech_start.is_none() {
            abs_speech
        } else {
            abs_speech && rms >= peak_rms * TRAILING_SILENCE_RATIO
        };
        if speech {
            if speech_start.is_none() {
                speech_start = Some(offset);
            }
            last_speech_end = offset + frame_bytes;
            trailing_silence_ms = 0;
            if rms > peak_rms {
                peak_rms = rms;
            }
        } else if speech_start.is_some() {
            trailing_silence_ms = trailing_silence_ms.saturating_add(FRAME_MS);
        }
        offset += frame_bytes;
    }

    Some(UtteranceBounds {
        speech_at: speech_start?,
        last_speech_end,
        trailing_silence_ms,
    })
}

fn trim_leading_silence(pcm: &mut Vec<u8>, format: &AudioFormat) {
    let pre_roll = bytes_for_ms(format, PRE_ROLL_MS);
    if pcm.len() > pre_roll {
        let drain = align_bytes(pcm.len() - pre_roll, format.block_align);
        if drain > 0 {
            pcm.drain(0..drain);
        }
    }
}

fn encode_chunk(chunk_bytes: Vec<u8>, format: &AudioFormat) -> Option<AudioChunk> {
    if chunk_bytes.is_empty() || !has_speech(&chunk_bytes, format) {
        return None;
    }

    let duration_ms = pcm_duration_ms(chunk_bytes.len(), format);
    let wav = encode_wav(&chunk_bytes, format);
    Some(AudioChunk {
        audio_base64: BASE64.encode(wav),
        duration_ms,
        sample_rate: format.sample_rate,
    })
}

fn align_bytes(bytes: usize, block_align: u16) -> usize {
    let align = block_align.max(1) as usize;
    bytes - (bytes % align)
}

fn bytes_for_ms(format: &AudioFormat, ms: u32) -> usize {
    let bytes = (format.sample_rate as u64 * format.block_align as u64 * ms as u64) / 1000;
    align_bytes(bytes as usize, format.block_align)
}

fn pcm_duration_ms(bytes: usize, format: &AudioFormat) -> u32 {
    let bytes_per_sec = format.sample_rate as u64 * format.block_align as u64;
    if bytes_per_sec == 0 {
        return 0;
    }
    ((bytes as u64 * 1000) / bytes_per_sec) as u32
}

fn has_speech(raw: &[u8], format: &AudioFormat) -> bool {
    let (rms, peak) = pcm_levels(raw, format);
    rms >= SPEECH_RMS_THRESHOLD || peak >= SPEECH_PEAK_THRESHOLD
}

fn pcm_levels(raw: &[u8], format: &AudioFormat) -> (f32, f32) {
    if raw.is_empty() {
        return (0.0, 0.0);
    }

    let sample_bytes = (format.bits_per_sample / 8).max(1) as usize;
    let mut sum_sq = 0.0_f64;
    let mut count = 0_u64;
    let mut peak = 0.0_f32;

    if format.is_float && format.bits_per_sample == 32 {
        let mut offset = 0;
        while offset + sample_bytes - 1 < raw.len() {
            let sample = f32::from_le_bytes([
                raw[offset],
                raw[offset + 1],
                raw[offset + 2],
                raw[offset + 3],
            ])
            .clamp(-1.0, 1.0);
            let abs = sample.abs();
            if abs > peak {
                peak = abs;
            }
            sum_sq += f64::from(sample) * f64::from(sample);
            count += 1;
            offset += sample_bytes;
        }
    } else if format.bits_per_sample == 16 {
        let mut offset = 0;
        while offset + 1 < raw.len() {
            let sample =
                i16::from_le_bytes([raw[offset], raw[offset + 1]]) as f32 / i16::MAX as f32;
            let abs = sample.abs();
            if abs > peak {
                peak = abs;
            }
            sum_sq += f64::from(sample) * f64::from(sample);
            count += 1;
            offset += sample_bytes;
        }
    } else {
        // Unknown format — don't discard.
        return (1.0, 1.0);
    }

    if count == 0 {
        return (0.0, 0.0);
    }

    let rms = (sum_sq / count as f64).sqrt() as f32;
    (rms, peak)
}

fn pcm_to_mono_i16_samples(raw: &[u8], format: &AudioFormat) -> Vec<i16> {
    let channels = format.channels.max(1) as usize;
    let sample_bytes = (format.bits_per_sample / 8).max(1) as usize;
    let frame_bytes = sample_bytes * channels;
    let mut out = Vec::new();

    if format.is_float && format.bits_per_sample == 32 {
        let mut offset = 0;
        while offset + frame_bytes <= raw.len() {
            let mut sum = 0.0f32;
            for ch in 0..channels {
                let base = offset + ch * 4;
                let sample = f32::from_le_bytes([
                    raw[base],
                    raw[base + 1],
                    raw[base + 2],
                    raw[base + 3],
                ])
                .clamp(-1.0, 1.0);
                sum += sample;
            }
            let avg = (sum / channels as f32).clamp(-1.0, 1.0);
            out.push((avg * i16::MAX as f32) as i16);
            offset += frame_bytes;
        }
    } else if format.bits_per_sample == 16 {
        let mut offset = 0;
        while offset + frame_bytes <= raw.len() {
            let mut sum = 0.0f32;
            for ch in 0..channels {
                let base = offset + ch * 2;
                let sample =
                    i16::from_le_bytes([raw[base], raw[base + 1]]) as f32 / i16::MAX as f32;
                sum += sample;
            }
            let avg = (sum / channels as f32).clamp(-1.0, 1.0);
            out.push((avg * i16::MAX as f32) as i16);
            offset += frame_bytes;
        }
    }

    out
}

fn resample_mono_16k(samples: &[i16], sample_rate: u32) -> (Vec<i16>, u32) {
    if samples.is_empty() {
        return (Vec::new(), sample_rate.max(1));
    }
    if sample_rate <= 16000 {
        return (samples.to_vec(), sample_rate.max(1));
    }
    let factor = (sample_rate as f64 / 16000.0).round().max(1.0) as usize;
    let decimated: Vec<i16> = samples.iter().step_by(factor).copied().collect();
    (decimated, 16000)
}

fn encode_wav(raw: &[u8], format: &AudioFormat) -> Vec<u8> {
    let mono = pcm_to_mono_i16_samples(raw, format);
    let (mono, sample_rate) = resample_mono_16k(&mono, format.sample_rate);
    let pcm16: Vec<u8> = mono.iter().flat_map(|sample| sample.to_le_bytes()).collect();

    let channels = 1u16;
    let byte_rate = sample_rate * 2;
    let block_align = 2u16;
    let data_size = pcm16.len() as u32;
    let riff_size = 36 + data_size;

    let mut wav = Vec::with_capacity(44 + pcm16.len());
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&riff_size.to_le_bytes());
    wav.extend_from_slice(b"WAVE");
    wav.extend_from_slice(b"fmt ");
    wav.extend_from_slice(&16u32.to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes());
    wav.extend_from_slice(&channels.to_le_bytes());
    wav.extend_from_slice(&sample_rate.to_le_bytes());
    wav.extend_from_slice(&byte_rate.to_le_bytes());
    wav.extend_from_slice(&block_align.to_le_bytes());
    wav.extend_from_slice(&16u16.to_le_bytes());
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_size.to_le_bytes());
    wav.extend_from_slice(&pcm16);
    wav
}

fn cap_buffer(pcm: &mut Vec<u8>, format: AudioFormat) {
    let max_bytes = format.sample_rate as usize
        * format.block_align as usize
        * MAX_BUFFER_SECS as usize;
    if pcm.len() > max_bytes {
        let drain = pcm.len() - max_bytes;
        pcm.drain(0..drain);
    }
}

fn append_pcm(
    pcm: &Mutex<Vec<u8>>,
    frames: &AtomicU64,
    format: AudioFormat,
    slice: &[u8],
    frame_count: u32,
) {
    if slice.is_empty() {
        return;
    }
    if let Ok(mut buf) = pcm.lock() {
        buf.extend_from_slice(slice);
        cap_buffer(&mut buf, format);
    }
    frames.fetch_add(frame_count as u64, Ordering::SeqCst);
}

#[cfg(windows)]
fn set_backend(backend: &Mutex<String>, value: &str) {
    if let Ok(mut slot) = backend.lock() {
        *slot = value.into();
    }
}

#[cfg(windows)]
fn run_capture_orchestrator(
    stop: &AtomicBool,
    frames: &AtomicU64,
    pcm: &Mutex<Vec<u8>>,
    format_slot: &Mutex<Option<AudioFormat>>,
    backend: &Mutex<String>,
) -> Result<(), String> {
    let _ = wasapi::initialize_mta();

    while !stop.load(Ordering::SeqCst) {
        // Speakers/headphones first — this is the audio the candidate actually hears
        // (Google Translate, YouTube, Zoom). Process loopback on a random chrome.exe
        // often captures silence and never falls through.
        set_backend(backend, "Device loopback (speakers)");
        match run_device_loopback(stop, frames, pcm, format_slot) {
            Ok(()) if stop.load(Ordering::SeqCst) => return Ok(()),
            Ok(()) => {}
            Err(err) => {
                eprintln!("[audio] device loopback failed: {err}");
            }
        }

        if stop.load(Ordering::SeqCst) {
            return Ok(());
        }

        if let Some((pid, process_name)) = find_meeting_process() {
            set_backend(
                backend,
                &format!("Process loopback ({process_name})"),
            );
            match run_process_loopback(pid, stop, frames, pcm, format_slot) {
                Ok(()) if stop.load(Ordering::SeqCst) => return Ok(()),
                Ok(()) => continue,
                Err(err) => {
                    eprintln!("[audio] process loopback failed for {process_name}: {err}");
                }
            }
        }

        if stop.load(Ordering::SeqCst) {
            return Ok(());
        }

        if let Some((pid, process_name)) = find_browser_process() {
            set_backend(backend, &format!("Browser audio ({process_name})"));
            match run_process_loopback(pid, stop, frames, pcm, format_slot) {
                Ok(()) if stop.load(Ordering::SeqCst) => return Ok(()),
                Ok(()) => continue,
                Err(err) => {
                    eprintln!("[audio] browser loopback failed for {process_name}: {err}");
                }
            }
        }

        if stop.load(Ordering::SeqCst) {
            return Ok(());
        }

        thread::sleep(Duration::from_millis(800));
    }
    Ok(())
}

#[cfg(windows)]
const MEETING_PROCESSES: &[(&str, u8)] = &[
    ("Zoom.exe", 10),
    ("ms-teams.exe", 10),
    ("Teams.exe", 10),
    ("Webex.exe", 9),
    ("slack.exe", 6),
];

const BROWSER_PROCESSES: &[&str] = &["chrome.exe", "msedge.exe", "firefox.exe", "brave.exe"];

#[cfg(windows)]
fn find_browser_process() -> Option<(u32, String)> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0).ok()?;
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };

        let mut matches: Vec<(u32, String)> = Vec::new();
        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                let end = entry
                    .szExeFile
                    .iter()
                    .position(|&ch| ch == 0)
                    .unwrap_or(entry.szExeFile.len());
                let name = String::from_utf16_lossy(&entry.szExeFile[..end]);
                let lower = name.to_lowercase();
                if BROWSER_PROCESSES.iter().any(|proc| lower == *proc) {
                    matches.push((entry.th32ProcessID, name));
                }
                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }

        let _ = CloseHandle(snapshot);
        matches.into_iter().max_by_key(|(pid, _)| *pid)
    }
}

#[cfg(windows)]
fn find_meeting_process() -> Option<(u32, String)> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0).ok()?;
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };

        let mut best: Option<(u32, String, u8)> = None;
        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                let end = entry
                    .szExeFile
                    .iter()
                    .position(|&ch| ch == 0)
                    .unwrap_or(entry.szExeFile.len());
                let name = String::from_utf16_lossy(&entry.szExeFile[..end]);
                let lower = name.to_lowercase();
                for (process_name, priority) in MEETING_PROCESSES {
                    if lower == process_name.to_lowercase()
                        && best
                            .as_ref()
                            .map(|(_, _, best_priority)| *priority > *best_priority)
                            .unwrap_or(true)
                    {
                        best = Some((entry.th32ProcessID, name.clone(), *priority));
                    }
                }
                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }

        let _ = CloseHandle(snapshot);
        best.map(|(pid, name, _)| (pid, name))
    }
}

#[cfg(windows)]
fn run_process_loopback(
    process_id: u32,
    stop: &AtomicBool,
    frames: &AtomicU64,
    pcm: &Mutex<Vec<u8>>,
    format_slot: &Mutex<Option<AudioFormat>>,
) -> Result<(), String> {
    use wasapi::{AudioClient, Direction, SampleType, StreamMode, WaveFormat};

    let format = AudioFormat {
        sample_rate: 48_000,
        channels: 2,
        block_align: 8,
        bits_per_sample: 32,
        is_float: true,
    };
    if let Ok(mut slot) = format_slot.lock() {
        *slot = Some(format);
    }

    let wave_format = WaveFormat::new(32, 32, &SampleType::Float, 48_000, 2, None);
    let bytes_per_frame = wave_format.get_blockalign() as usize;

    let mut client = AudioClient::new_application_loopback_client(process_id, true)
        .map_err(|e| format!("Process loopback client: {e}"))?;
    client
        .initialize_client(
            &wave_format,
            &Direction::Capture,
            &StreamMode::PollingShared {
                autoconvert: true,
                buffer_duration_hns: 200_000,
            },
        )
        .map_err(|e| format!("Process loopback init: {e}"))?;
    client
        .start_stream()
        .map_err(|e| format!("Process loopback start: {e}"))?;

    let capture = client
        .get_audiocaptureclient()
        .map_err(|e| format!("Process capture client: {e}"))?;

    while !stop.load(Ordering::SeqCst) {
        match capture.get_next_packet_size() {
            Ok(Some(packet)) if packet > 0 => {
                let byte_count = packet as usize * bytes_per_frame;
                let mut buffer = vec![0_u8; byte_count];
                if let Ok((read_frames, _info)) = capture.read_from_device(&mut buffer) {
                    let valid = read_frames as usize * bytes_per_frame;
                    append_pcm(
                        pcm,
                        frames,
                        format,
                        &buffer[..valid.min(buffer.len())],
                        read_frames,
                    );
                }
            }
            Ok(_) => thread::sleep(Duration::from_millis(20)),
            Err(_) => thread::sleep(Duration::from_millis(40)),
        }
    }

    let _ = client.stop_stream();
    Ok(())
}

#[cfg(windows)]
fn parse_wave_format(mix: *mut windows::Win32::Media::Audio::WAVEFORMATEX) -> AudioFormat {
    unsafe {
        let tag = (*mix).wFormatTag;
        let bits = (*mix).wBitsPerSample;
        AudioFormat {
            sample_rate: (*mix).nSamplesPerSec,
            channels: (*mix).nChannels.max(1),
            block_align: (*mix).nBlockAlign.max(1),
            bits_per_sample: bits.max(16),
            is_float: tag == 3 || bits == 32,
        }
    }
}

#[cfg(windows)]
fn run_device_loopback(
    stop: &AtomicBool,
    frames: &AtomicU64,
    pcm: &Mutex<Vec<u8>>,
    format_slot: &Mutex<Option<AudioFormat>>,
) -> Result<(), String> {
    use windows::Win32::Media::Audio::{
        eConsole, eRender, IAudioCaptureClient, IAudioClient, IMMDeviceEnumerator,
        MMDeviceEnumerator, AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemFree, CLSCTX_ALL, COINIT_MULTITHREADED,
    };

    unsafe {
        CoInitializeEx(None, COINIT_MULTITHREADED)
            .ok()
            .map_err(|e| format!("COM init failed: {e}"))?;

        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
                .map_err(|e| format!("WASAPI enumerator: {e}"))?;
        let device = enumerator
            .GetDefaultAudioEndpoint(eRender, eConsole)
            .map_err(|e| format!("Default render device: {e}"))?;
        let client: IAudioClient = device
            .Activate(CLSCTX_ALL, None)
            .map_err(|e| format!("IAudioClient activate: {e}"))?;

        let mix = client
            .GetMixFormat()
            .map_err(|e| format!("GetMixFormat: {e}"))?;
        if mix.is_null() {
            return Err("WASAPI mix format was null".into());
        }

        let format = parse_wave_format(mix);
        if let Ok(mut slot) = format_slot.lock() {
            *slot = Some(format);
        }

        let init = client.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK,
            10_000_000,
            0,
            mix,
            None,
        );
        if let Err(e) = init {
            CoTaskMemFree(Some(mix as *const _ as *const std::ffi::c_void));
            return Err(format!("WASAPI loopback init: {e}"));
        }

        let capture: IAudioCaptureClient = client
            .GetService()
            .map_err(|e| format!("IAudioCaptureClient: {e}"))?;
        client.Start().map_err(|e| format!("WASAPI start: {e}"))?;

        while !stop.load(Ordering::SeqCst) {
            match capture.GetNextPacketSize() {
                Ok(packet) if packet > 0 => {
                    let mut data: *mut u8 = std::ptr::null_mut();
                    let mut num_frames = 0u32;
                    let mut flags = 0u32;
                    if capture
                        .GetBuffer(&mut data, &mut num_frames, &mut flags, None, None)
                        .is_ok()
                        && !data.is_null()
                        && num_frames > 0
                    {
                        let byte_count = num_frames as usize * format.block_align as usize;
                        let slice = std::slice::from_raw_parts(data, byte_count);
                        append_pcm(pcm, frames, format, slice, num_frames);
                        let _ = capture.ReleaseBuffer(num_frames);
                    }
                }
                Ok(_) => thread::sleep(Duration::from_millis(20)),
                Err(_) => thread::sleep(Duration::from_millis(40)),
            }
        }

        let _ = client.Stop();
        CoTaskMemFree(Some(mix as *const _ as *const std::ffi::c_void));
    }
    Ok(())
}
