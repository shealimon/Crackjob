"use client";

import { useCallback, useEffect, useState } from "react";
import { PanelLoading } from "@/components/dashboard/panel-loading";
import { Spinner } from "@/components/loading-button";

type DayQuestions = {
  date: string;
  questions: string[];
};

type QuestionsResponse = {
  days: DayQuestions[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  error?: string;
};

const PAGE_SIZE = 10;

function formatDateLabel(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function pageWindow(current: number, total: number) {
  const maxButtons = 5;
  if (total <= maxButtons) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  let start = Math.max(1, current - 2);
  let end = start + maxButtons - 1;
  if (end > total) {
    end = total;
    start = Math.max(1, end - maxButtons + 1);
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function QuestionsPanel() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<QuestionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/questions?page=${nextPage}&pageSize=${PAGE_SIZE}`,
      );
      const body = (await res.json()) as QuestionsResponse;
      if (!res.ok) {
        setError(body.error || "Could not load questions.");
        setData(null);
        return;
      }
      setData(body);
      setPage(body.page);
    } catch {
      setError("Could not load questions.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  const totalPages = data?.totalPages ?? 1;
  const pages = pageWindow(page, totalPages);
  const questionCount =
    data?.days.reduce((sum, day) => sum + day.questions.length, 0) ?? 0;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
          Questions
        </h1>
        <p className="mt-2 text-sm text-black/50">
          Interview questions synced from the desktop app, newest days first.
        </p>
      </div>

      <div className="flex-1 space-y-4">
        {loading && !data ? <PanelLoading label="Loading questions…" /> : null}

        {error ? (
          <div className="rounded-2xl border border-black/10 bg-white p-6 text-sm text-black/60">
            {error}
          </div>
        ) : null}

        {!loading && !error && data && data.total === 0 ? (
          <div className="rounded-2xl border border-black/8 bg-white p-8 text-center">
            <p className="text-sm font-medium text-black">No questions yet</p>
            <p className="mt-2 text-sm text-black/50">
              Questions from interviews will show up here after the Windows app syncs.
            </p>
          </div>
        ) : null}

        {data?.days.map((day) => (
          <section
            key={day.date}
            className="rounded-2xl border border-black/8 bg-white p-5 sm:p-6"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-black">
                {formatDateLabel(day.date)}
              </h2>
              <p className="text-xs text-black/40">
                {day.questions.length}{" "}
                {day.questions.length === 1 ? "question" : "questions"}
              </p>
            </div>
            <ol className="mt-4 space-y-3">
              {day.questions.map((question, index) => (
                <li
                  key={`${day.date}-${index}`}
                  className="flex gap-3 text-sm leading-relaxed text-black/80"
                >
                  <span className="mt-0.5 w-5 shrink-0 text-right text-xs tabular-nums text-black/35">
                    {index + 1}.
                  </span>
                  <span className="min-w-0 whitespace-pre-wrap">{question}</span>
                </li>
              ))}
            </ol>
          </section>
        ))}

        {loading && data ? (
          <div
            className="flex items-center justify-center gap-2 py-3 text-xs text-black/45"
            role="status"
            aria-live="polite"
          >
            <Spinner className="size-3.5" />
            Loading…
          </div>
        ) : null}
      </div>

      {data && data.total > 0 ? (
        <footer className="sticky bottom-0 border-t border-black/8 bg-[var(--dash-bg)] pt-4 pb-1">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-black/45">
              Page {page} of {totalPages}
              {questionCount > 0
                ? ` · ${questionCount} question${questionCount === 1 ? "" : "s"} on this page`
                : ""}
              {data.total > 0 ? ` · ${data.total} day${data.total === 1 ? "" : "s"} total` : ""}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => void load(page - 1)}
                className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-black/60 transition hover:bg-black/[0.04] hover:text-black disabled:pointer-events-none disabled:opacity-35"
              >
                Prev
              </button>
              {pages.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={loading}
                  onClick={() => void load(n)}
                  className={`min-w-8 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition ${
                    n === page
                      ? "bg-black text-white"
                      : "text-black/60 hover:bg-black/[0.04] hover:text-black"
                  } disabled:pointer-events-none disabled:opacity-35`}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => void load(page + 1)}
                className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-black/60 transition hover:bg-black/[0.04] hover:text-black disabled:pointer-events-none disabled:opacity-35"
              >
                Next
              </button>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
