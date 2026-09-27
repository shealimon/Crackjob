use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InterviewDayFile {
    pub date: String,
    #[serde(default)]
    pub sessions: Vec<InterviewSessionLog>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InterviewSessionLog {
    pub session_id: String,
    pub started_at: String,
    #[serde(default)]
    pub mode: String,
    #[serde(default)]
    pub company_pack: String,
    #[serde(default)]
    pub entries: Vec<InterviewEntryLog>,
}

/// Local entry — id / time / question / answer / synced are written to disk.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InterviewEntryLog {
    pub id: String,
    pub time: String,
    pub question: String,
    /// Model answer / solution text for this question (optional for older files).
    #[serde(default)]
    pub answer: String,
    #[serde(default)]
    pub synced: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppendInterviewEntryInput {
    pub session_id: String,
    pub started_at: String,
    pub mode: String,
    pub company_pack: String,
    pub entry_id: String,
    pub time: String,
    pub question: String,
    #[serde(default)]
    pub answer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkInterviewSyncedInput {
    pub date: String,
}

fn normalize_question_key(question: &str) -> String {
    question
        .trim()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c.is_whitespace() {
                c.to_ascii_lowercase()
            } else {
                ' '
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn interview_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("interview-questions");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn day_path(app: &AppHandle, date: &str) -> Result<std::path::PathBuf, String> {
    Ok(interview_dir(app)?.join(format!("{date}.json")))
}

fn empty_day(date: &str) -> InterviewDayFile {
    InterviewDayFile {
        date: date.to_string(),
        sessions: Vec::new(),
    }
}

pub fn load_day(app: &AppHandle, date: &str) -> InterviewDayFile {
    let Ok(path) = day_path(app, date) else {
        return empty_day(date);
    };
    let Ok(raw) = std::fs::read_to_string(path) else {
        return empty_day(date);
    };
    serde_json::from_str::<InterviewDayFile>(&raw).unwrap_or_else(|_| empty_day(date))
}

fn save_day(app: &AppHandle, day: &InterviewDayFile) -> Result<(), String> {
    let path = day_path(app, &day.date)?;
    let raw = serde_json::to_string_pretty(day).map_err(|e| e.to_string())?;
    std::fs::write(path, raw).map_err(|e| e.to_string())
}

/// Append a question to today's file. Same session + same question → skip.
/// Never deletes existing data.
pub fn append_entry(app: &AppHandle, date: &str, input: AppendInterviewEntryInput) -> Result<InterviewDayFile, String> {
    let mut day = load_day(app, date);
    if day.date.is_empty() {
        day.date = date.to_string();
    }

    let session = if let Some(existing) = day
        .sessions
        .iter_mut()
        .find(|s| s.session_id == input.session_id)
    {
        existing
    } else {
        day.sessions.push(InterviewSessionLog {
            session_id: input.session_id.clone(),
            started_at: input.started_at.clone(),
            mode: input.mode.clone(),
            company_pack: input.company_pack.clone(),
            entries: Vec::new(),
        });
        day.sessions.last_mut().unwrap()
    };

    if !input.mode.is_empty() {
        session.mode = input.mode.clone();
    }
    if !input.company_pack.is_empty() {
        session.company_pack = input.company_pack.clone();
    }

    let key = normalize_question_key(&input.question);
    if !key.is_empty() {
        if let Some(existing) = session
            .entries
            .iter_mut()
            .find(|e| normalize_question_key(&e.question) == key)
        {
            // Same question again — fill in answer if we now have one.
            if !input.answer.trim().is_empty() && existing.answer.trim().is_empty() {
                existing.answer = input.answer;
                existing.synced = false;
                save_day(app, &day)?;
            }
            eprintln!(
                "[interview-log] skip duplicate session={} question={}",
                input.session_id, key
            );
            return Ok(day);
        }
    }

    session.entries.push(InterviewEntryLog {
        id: input.entry_id,
        time: input.time,
        question: input.question,
        answer: input.answer,
        synced: false,
    });
    let entry_count = session.entries.len();

    save_day(app, &day)?;
    eprintln!(
        "[interview-log] saved {} → {} ({} entries)",
        date,
        day_path(app, date)
            .map(|p| p.display().to_string())
            .unwrap_or_default(),
        entry_count
    );
    Ok(day)
}

pub fn mark_day_synced(app: &AppHandle, date: &str) -> Result<InterviewDayFile, String> {
    let mut day = load_day(app, date);
    for session in day.sessions.iter_mut() {
        for entry in session.entries.iter_mut() {
            entry.synced = true;
        }
    }
    save_day(app, &day)?;
    Ok(day)
}

/// Load recent day files (newest first). Does not delete anything.
pub fn load_recent_days(app: &AppHandle, max_days: usize) -> Result<Vec<InterviewDayFile>, String> {
    let dir = interview_dir(app)?;
    let mut dates = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.ends_with(".json") && name.len() >= 15 {
                dates.push(name.trim_end_matches(".json").to_string());
            }
        }
    }
    dates.sort();
    dates.reverse();
    let take = max_days.max(1).min(60);
    Ok(dates
        .into_iter()
        .take(take)
        .map(|date| load_day(app, &date))
        .collect())
}

pub fn list_unsynced(app: &AppHandle, max_days: usize) -> Result<Vec<InterviewDayFile>, String> {
    let days = load_recent_days(app, max_days)?;
    Ok(days
        .into_iter()
        .filter_map(|mut day| {
            day.sessions.retain(|s| s.entries.iter().any(|e| !e.synced));
            for session in day.sessions.iter_mut() {
                session.entries.retain(|e| !e.synced);
            }
            if day.sessions.is_empty() {
                None
            } else {
                Some(day)
            }
        })
        .collect())
}
