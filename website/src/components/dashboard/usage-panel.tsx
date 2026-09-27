"use client";

import { useMemo, useState } from "react";
import { DownloadIcon } from "@/components/dashboard/icons";
import type {
  DashboardPayload,
  DashboardUsageDay,
  DashboardUsageEvent,
} from "@/lib/dashboard-data";

type Period = "1d" | "7d" | "30d" | "mtd" | "last_month";

const PERIODS: { id: Period; label: string }[] = [
  { id: "1d", label: "1d" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "mtd", label: "MTD" },
  { id: "last_month", label: "Last month" },
];

const ROW_OPTIONS = [25, 50, 100] as const;

function utcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function formatCompact(n: number) {
  if (n <= 0) return "0";
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v >= 100 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${v >= 100 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return n.toLocaleString("en-US");
}

function formatAxis(n: number) {
  if (n <= 0) return "0";
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function formatMonthDay(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
}

function periodRange(period: Period): { start: Date; end: Date } {
  const end = utcDay(new Date());
  const start = new Date(end);

  if (period === "1d") {
    return { start: end, end };
  }
  if (period === "7d") {
    start.setUTCDate(end.getUTCDate() - 6);
    return { start, end };
  }
  if (period === "30d") {
    start.setUTCDate(end.getUTCDate() - 29);
    return { start, end };
  }
  if (period === "mtd") {
    start.setUTCDate(1);
    return { start, end };
  }
  // last calendar month
  const lastMonthEnd = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 0),
  );
  const lastMonthStart = new Date(
    Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1),
  );
  return { start: lastMonthStart, end: lastMonthEnd };
}

function daysInRange(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function eventType(event: DashboardUsageEvent) {
  return event.accessLevel === "explore" ? "Free" : "Included";
}

function UsageAreaChart({
  points,
  todayIso,
}: {
  points: { date: string; cumulative: number }[];
  todayIso: string;
}) {
  const width = 720;
  const height = 260;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const maxY = Math.max(1, ...points.map((p) => p.cumulative));
  const niceMax = (() => {
    const exp = Math.pow(10, Math.floor(Math.log10(maxY)));
    const n = maxY / exp;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * exp;
  })();

  const xs = points.map((_, i) =>
    points.length === 1
      ? padL + plotW / 2
      : padL + (i / (points.length - 1)) * plotW,
  );
  const ys = points.map(
    (p) => padT + plotH - (p.cumulative / niceMax) * plotH,
  );

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xs[i]} ${ys[i]}`)
    .join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L ${xs[xs.length - 1]} ${padT + plotH} L ${xs[0]} ${padT + plotH} Z`
      : "";

  const yTicks = [
    ...new Set([0, 0.33, 0.66, 1].map((t) => Math.round(niceMax * t))),
  ];
  const xLabelEvery = Math.max(1, Math.ceil(points.length / 7));
  const todayIndex = points.findIndex((p) => p.date === todayIso);

  return (
    <div className="relative w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[240px] w-full sm:h-[280px]"
        role="img"
        aria-label="Cumulative token usage chart"
      >
        {yTicks.map((tick) => {
          const y = padT + plotH - (tick / niceMax) * plotH;
          return (
            <g key={tick}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke="rgba(0,0,0,0.06)"
              />
              <text
                x={padL - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-black/40"
                fontSize="10"
              >
                {formatAxis(tick)}
              </text>
            </g>
          );
        })}

        <text
          x={12}
          y={height / 2}
          textAnchor="middle"
          transform={`rotate(-90 12 ${height / 2})`}
          className="fill-black/35"
          fontSize="10"
        >
          Cumulative Tokens
        </text>

        {areaPath ? (
          <>
            <defs>
              <linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7eb89a" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#7eb89a" stopOpacity="0.08" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#usageFill)" />
            <path
              d={linePath}
              fill="none"
              stroke="#6aa88a"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        ) : null}

        {todayIndex >= 0 ? (
          <g>
            <line
              x1={xs[todayIndex]}
              x2={xs[todayIndex]}
              y1={padT}
              y2={padT + plotH}
              stroke="rgba(0,0,0,0.25)"
              strokeDasharray="3 3"
            />
            <rect
              x={xs[todayIndex] - 22}
              y={padT + 2}
              width={44}
              height={16}
              rx={4}
              fill="rgba(0,0,0,0.06)"
            />
            <text
              x={xs[todayIndex]}
              y={padT + 13}
              textAnchor="middle"
              className="fill-black/50"
              fontSize="9"
            >
              today
            </text>
          </g>
        ) : null}

        {points.map((p, i) =>
          i % xLabelEvery === 0 || i === points.length - 1 ? (
            <text
              key={p.date}
              x={xs[i]}
              y={height - 12}
              textAnchor="middle"
              className="fill-black/40"
              fontSize="10"
            >
              {formatMonthDay(p.date)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

export function UsagePanel({ initial }: { initial: DashboardPayload }) {
  const allDays = initial.usageByDay ?? [];
  const allEvents = initial.usageEvents ?? [];
  const [period, setPeriod] = useState<Period>("7d");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] =
    useState<(typeof ROW_OPTIONS)[number]>(100);

  const { start, end } = useMemo(() => periodRange(period), [period]);
  const startIso = start.toISOString().slice(0, 10);
  const endIso = end.toISOString().slice(0, 10);
  const todayIso = utcDay(new Date()).toISOString().slice(0, 10);

  const filteredDays = useMemo(() => {
    const map = new Map(allDays.map((d) => [d.date, d]));
    return daysInRange(start, end).map(
      (date): DashboardUsageDay =>
        map.get(date) ?? {
          date,
          creditsUsed: 0,
          solves: 0,
          exploreSolves: 0,
          fullSolves: 0,
        },
    );
  }, [allDays, start, end]);

  const chartPoints = useMemo(() => {
    let running = 0;
    return filteredDays.map((d) => {
      running += d.creditsUsed;
      return { date: d.date, cumulative: running };
    });
  }, [filteredDays]);

  const totalTokens = chartPoints.at(-1)?.cumulative ?? 0;
  const includedTokens = useMemo(
    () =>
      filteredDays.reduce((sum, d) => {
        // Approximate included vs free from event mix when available
        return sum + d.creditsUsed;
      }, 0),
    [filteredDays],
  );

  const filteredEvents = useMemo(() => {
    const startMs = start.getTime();
    const endMs = end.getTime() + 24 * 60 * 60 * 1000 - 1;
    return allEvents.filter((e) => {
      const t = new Date(e.createdAt).getTime();
      return t >= startMs && t <= endMs;
    });
  }, [allEvents, start, end]);

  const includedFromEvents = useMemo(
    () =>
      filteredEvents
        .filter((e) => e.accessLevel !== "explore")
        .reduce((s, e) => s + e.creditsUsed, 0),
    [filteredEvents],
  );
  const freeFromEvents = useMemo(
    () =>
      filteredEvents
        .filter((e) => e.accessLevel === "explore")
        .reduce((s, e) => s + e.creditsUsed, 0),
    [filteredEvents],
  );

  const displayIncluded =
    filteredEvents.length > 0 ? includedFromEvents : includedTokens;
  const displayTotal =
    filteredEvents.length > 0
      ? includedFromEvents + freeFromEvents
      : totalTokens;

  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / rowsPerPage));
  const safePage = Math.min(page, pageCount - 1);
  const pageEvents = filteredEvents.slice(
    safePage * rowsPerPage,
    safePage * rowsPerPage + rowsPerPage,
  );
  const showingFrom =
    filteredEvents.length === 0 ? 0 : safePage * rowsPerPage + 1;
  const showingTo = Math.min(
    (safePage + 1) * rowsPerPage,
    filteredEvents.length,
  );

  function exportCsv() {
    const header = ["Date (UTC)", "Type", "Model", "Tokens", "Cost"];
    const lines = filteredEvents.map((e) => {
      const type = eventType(e);
      return [
        formatEventDate(e.createdAt),
        type,
        e.model || "—",
        String(e.creditsUsed),
        type,
      ]
        .map((cell) => `"${cell.replaceAll('"', '""')}"`)
        .join(",");
    });
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crack-usage-${startIso}-${endIso}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const rangeLabel = `${formatMonthDay(startIso)} - ${formatMonthDay(endIso)}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
          Usage
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-black/55">
            <svg
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5 text-black/40"
              fill="none"
              aria-hidden
            >
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M8 4.5V8l2.2 1.4"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            <span>{rangeLabel}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-black/[0.03] p-1">
            {PERIODS.map((p) => {
              const active = period === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPeriod(p.id);
                    setPage(0);
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    active
                      ? "bg-white text-black shadow-sm"
                      : "text-black/50 hover:text-black/80"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        {[
          { label: "Total tokens", value: formatCompact(displayTotal) },
          { label: "Included", value: formatCompact(displayIncluded) },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-black/8 bg-white px-5 py-4"
          >
            <p className="text-xs text-black/45">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-black">
              {card.value}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-black/8 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-black">Your Usage</h2>
            <p className="mt-1 text-sm text-black/45">
              Your usage per day across this billing period
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm text-black/70">
            <span className="text-black/40">Group By</span>
            <span className="font-medium text-black">Model</span>
            <span className="text-black/30" aria-hidden>
              ▾
            </span>
          </div>
        </div>

        <div className="mt-4">
          <UsageAreaChart points={chartPoints} todayIso={todayIso} />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-black/55">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-[2px] bg-[#7eb89a]" />
            auto
          </span>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-black/8 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/6 text-left text-xs text-black/40">
                <th className="px-5 py-3 font-medium">Date (UTC)</th>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">Model</th>
                <th className="px-3 py-3 text-right font-medium">Tokens</th>
                <th className="px-5 py-3 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {pageEvents.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-sm text-black/45"
                  >
                    No usage in this period yet.
                  </td>
                </tr>
              ) : (
                pageEvents.map((event) => {
                  const type = eventType(event);
                  return (
                    <tr
                      key={event.id}
                      className="border-b border-black/[0.04] last:border-0"
                    >
                      <td className="px-5 py-3.5 text-black/70">
                        {formatEventDate(event.createdAt)}
                      </td>
                      <td className="px-3 py-3.5 text-black/70">{type}</td>
                      <td className="px-3 py-3.5 text-black/70">
                        {event.model || "—"}
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-black/80">
                        {event.creditsUsed > 0
                          ? formatCompact(event.creditsUsed)
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right text-black/70">
                        {type}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/6 px-5 py-3 text-xs text-black/50">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2">
              <span>Rows</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(
                    Number(e.target.value) as (typeof ROW_OPTIONS)[number],
                  );
                  setPage(0);
                }}
                className="rounded-md border border-black/10 bg-white px-2 py-1 text-black/70 outline-none"
              >
                {ROW_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <span>
              Showing {showingFrom}-{showingTo} of {filteredEvents.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-md px-2.5 py-1 text-black/60 transition enabled:hover:bg-black/[0.04] disabled:opacity-35"
            >
              Prev
            </button>
            <span className="tabular-nums text-black/55">
              {safePage + 1} / {pageCount}
            </span>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="rounded-md px-2.5 py-1 text-black/60 transition enabled:hover:bg-black/[0.04] disabled:opacity-35"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3.5 py-2 text-sm font-medium text-black/70 transition hover:bg-black/[0.03]"
        >
          <DownloadIcon className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>
    </div>
  );
}
