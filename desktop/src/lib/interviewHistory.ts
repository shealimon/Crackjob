import { invoke } from "@tauri-apps/api/core";
import {
  isGenericQuestionLabel,
  isNoiseTranscription,
  isSameSpokenQuestion,
  isSubstantialQuestion,
  isTruncatedQuestion,
  isWhisperHallucination,
  normalizeUtterance,
} from "./interviewSpeech";

export type InterviewEntryLog = {
  id: string;
  time: string;
  question: string;
  /** Model answer / solution for this question (empty on older day files). */
  answer?: string;
  synced: boolean;
};

export type InterviewSessionLog = {
  sessionId: string;
  startedAt: string;
  mode: string;
  companyPack: string;
  entries: InterviewEntryLog[];
};

export type InterviewDayFile = {
  date: string;
  sessions: InterviewSessionLog[];
};

export function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function questionKeyFromText(question: string) {
  return normalizeUtterance(question).slice(0, 240);
}

export function newSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Skip unclear / incomplete audio so junk never hits local disk or sync. */
function shouldSkipUnclearQuestion(question: string, hasAnswer: boolean) {
  if (!question || question.length < 3) return true;
  if (isGenericQuestionLabel(question)) return true;
  if (isWhisperHallucination(question) || isNoiseTranscription(question)) return true;
  // Answered Q&A: keep unless it's pure filler/hallucination (already handled).
  if (hasAnswer) return false;
  if (isTruncatedQuestion(question)) return true;
  if (!isSubstantialQuestion(question)) return true;
  return false;
}

/**
 * Drop unclear scraps + merge near-duplicates across sessions before POST.
 * Local-only — no GPT / no extra server calls.
 */
export function cleanInterviewDayForSync(day: InterviewDayFile): InterviewDayFile {
  type Ranked = {
    sessionIndex: number;
    entry: InterviewEntryLog;
  };

  const ranked: Ranked[] = [];
  day.sessions.forEach((session, sessionIndex) => {
    for (const entry of session.entries) {
      const question = entry.question.trim();
      const answer = entry.answer?.trim() || "";
      if (shouldSkipUnclearQuestion(question, Boolean(answer))) continue;
      ranked.push({ sessionIndex, entry: { ...entry, question, answer } });
    }
  });

  const kept: Ranked[] = [];
  for (const item of ranked) {
    const dupIdx = kept.findIndex((existing) =>
      isSameSpokenQuestion(existing.entry.question, item.entry.question),
    );
    if (dupIdx < 0) {
      kept.push(item);
      continue;
    }
    const prev = kept[dupIdx];
    const prevHasAnswer = Boolean(prev.entry.answer?.trim());
    const nextHasAnswer = Boolean(item.entry.answer?.trim());
    const nextLonger = item.entry.question.length > prev.entry.question.length;
    if ((nextHasAnswer && !prevHasAnswer) || (nextHasAnswer === prevHasAnswer && nextLonger)) {
      kept[dupIdx] = {
        ...item,
        entry: {
          ...item.entry,
          answer: item.entry.answer?.trim() || prev.entry.answer || "",
          question:
            item.entry.question.length >= prev.entry.question.length
              ? item.entry.question
              : prev.entry.question,
        },
      };
    } else if (nextHasAnswer && !prev.entry.answer?.trim()) {
      kept[dupIdx] = {
        ...prev,
        entry: { ...prev.entry, answer: item.entry.answer },
      };
    }
  }

  const bySession = new Map<number, InterviewEntryLog[]>();
  for (const item of kept) {
    const list = bySession.get(item.sessionIndex) ?? [];
    list.push(item.entry);
    bySession.set(item.sessionIndex, list);
  }

  const sessions = day.sessions
    .map((session, index) => {
      const entries = bySession.get(index) ?? [];
      if (!entries.length) return null;
      return { ...session, entries };
    })
    .filter((s): s is InterviewSessionLog => Boolean(s));

  return { date: day.date, sessions };
}

export async function appendInterviewEntry(input: {
  sessionId: string;
  startedAt: string;
  mode: string;
  companyPack: string;
  entryId: string;
  question: string;
  answer?: string;
  time?: string;
}) {
  const question = input.question.trim();
  const answer = input.answer?.trim() || "";
  if (shouldSkipUnclearQuestion(question, Boolean(answer))) return null;

  const date = localDateKey();
  const time = input.time || new Date().toISOString();

  return invoke<InterviewDayFile>("append_interview_entry", {
    date,
    entry: {
      sessionId: input.sessionId,
      startedAt: input.startedAt,
      mode: input.mode,
      companyPack: input.companyPack,
      entryId: input.entryId,
      time,
      question,
      answer,
    },
  });
}

export async function loadInterviewDay(date: string) {
  return invoke<InterviewDayFile>("load_interview_day", { date });
}

export async function loadInterviewHistory(maxDays = 14) {
  return invoke<InterviewDayFile[]>("load_interview_history", { maxDays });
}

export async function listUnsyncedInterviewEntries(maxDays = 30) {
  return invoke<InterviewDayFile[]>("list_unsynced_interview_entries", { maxDays });
}

/** Mark every entry in a day file as synced after DB upsert. */
export async function markInterviewDaySynced(date: string) {
  return invoke<InterviewDayFile>("mark_interview_synced", { payload: { date } });
}

/** Dates that still have unsynced questions (need a day-row upsert). */
export function unsyncedDates(days: InterviewDayFile[]) {
  return [...new Set(days.map((d) => d.date).filter(Boolean))];
}
