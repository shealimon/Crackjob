"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDashboardData } from "@/components/dashboard/dashboard-data";
import { useDashboardNav } from "@/components/dashboard/nav";
import { startPlanCheckout } from "@/components/dashboard/razorpay-checkout";
import { LoadingButton } from "@/components/loading-button";
import { useToast } from "@/components/toast";
import { PLAN_PACKS } from "@/lib/constants";
import type { DashboardPayload, DashboardUsageDay } from "@/lib/dashboard-data";
import {
  FREE_EXPLORE_SOLVES,
  FREE_FULL_SOLVES,
  FREE_PARTIAL_SOLVES,
  planLabel,
} from "@/lib/plans";

type HeatFilter = "all" | "explore" | "full";

const HEAT_COLORS = [
  "bg-black/[0.06]",
  "bg-emerald-200",
  "bg-emerald-400",
  "bg-emerald-600",
  "bg-emerald-800",
] as const;

function solvesForFilter(day: DashboardUsageDay, filter: HeatFilter) {
  if (filter === "explore") return day.exploreSolves ?? 0;
  if (filter === "full") return day.fullSolves ?? 0;
  return day.solves ?? 0;
}

function heatLevel(value: number, max: number) {
  if (value <= 0 || max <= 0) return 0;
  const ratio = value / max;
  if (ratio <= 0.2) return 1;
  if (ratio <= 0.45) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function formatMonthDay(iso: string) {
  const d = new Date(`${iso}T12:00:00+05:30`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function monthName(isoPrefix: string) {
  const d = new Date(`${isoPrefix}-15T12:00:00+05:30`);
  return d.toLocaleDateString("en-US", {
    month: "long",
    timeZone: "Asia/Kolkata",
  });
}

/** IST calendar YYYY-MM-DD for "today". */
function istTodayIso() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Sep → Aug year that contains `todayIso` (ends Aug, never a second Sep). */
function sepAugBounds(todayIso: string) {
  const [y, m] = todayIso.split("-").map(Number);
  const sepYear = m >= 9 ? y : y - 1;
  return {
    start: `${sepYear}-09-01`,
    end: `${sepYear + 1}-08-31`,
  };
}

function addCalendarDays(iso: string, delta: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta, 6, 30, 0));
  return dt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function daysFromTo(start: string, end: string) {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addCalendarDays(cur, 1);
  }
  return out;
}

function computeStreaks(values: { date: string; count: number }[]) {
  let longest = 0;
  let current = 0;
  let run = 0;
  for (const day of values) {
    if (day.count > 0) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  // Current streak: walk back from the end, allowing today to be empty.
  let i = values.length - 1;
  if (i >= 0 && values[i].count <= 0) i -= 1;
  while (i >= 0 && values[i].count > 0) {
    current += 1;
    i -= 1;
  }
  return { longest, current };
}

function ActivityHeatmap({
  days,
  loading,
}: {
  days: DashboardUsageDay[];
  loading: boolean;
}) {
  const [filter, setFilter] = useState<HeatFilter>("all");

  const todayIso = istTodayIso();

  const series = useMemo(() => {
    const byDate = new Map(
      days.map((d) => [d.date, solvesForFilter(d, filter)] as const),
    );
    const { start, end } = sepAugBounds(todayIso);
    return daysFromTo(start, end).map((date) => ({
      date,
      count: byDate.get(date) ?? 0,
    }));
  }, [days, filter, todayIso]);

  // Stats / total only through today (ignore empty future days in Sep→Aug year).
  const seriesThroughToday = useMemo(
    () => series.filter((d) => d.date <= todayIso),
    [series, todayIso],
  );

  const total = seriesThroughToday.reduce((sum, d) => sum + d.count, 0);
  const max = Math.max(1, ...seriesThroughToday.map((d) => d.count));

  const weeks = useMemo(() => {
    if (series.length === 0) return [] as { date: string; count: number }[][];
    const start = new Date(`${series[0].date}T12:00:00+05:30`);
    const dow = start.getUTCDay(); // 0 Sun … pad so columns are Mon–Sun
    const mondayOffset = (dow + 6) % 7;
    const padded: ({ date: string; count: number } | null)[] = [
      ...Array.from({ length: mondayOffset }, () => null),
      ...series,
    ];
    const cols: ({ date: string; count: number } | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) {
      cols.push(padded.slice(i, i + 7));
    }
    return cols;
  }, [series]);

  // Month labels: Sep, Oct, Nov… — skip when too close so text doesn't overlap.
  const monthLabels = useMemo(() => {
    const labels: { index: number; label: string }[] = [];
    let lastMonth = "";
    let lastIndex = -99;
    weeks.forEach((week, index) => {
      const first = week.find((d) => d)?.date;
      if (!first) return;
      const key = first.slice(0, 7);
      if (key === lastMonth) return;
      lastMonth = key;
      if (labels.length > 0 && index - lastIndex < 3) return;
      lastIndex = index;
      labels.push({
        index,
        label: new Date(`${first}T12:00:00+05:30`).toLocaleDateString("en-US", {
          month: "short",
          timeZone: "Asia/Kolkata",
        }),
      });
    });
    return labels;
  }, [weeks]);

  const stats = useMemo(() => {
    if (seriesThroughToday.length === 0) {
      return {
        mostActiveMonth: "—",
        mostActiveDay: "—",
        longest: 0,
        current: 0,
      };
    }
    const byMonth = new Map<string, number>();
    let bestDay = seriesThroughToday[0];
    for (const day of seriesThroughToday) {
      const m = day.date.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) ?? 0) + day.count);
      if (day.count > bestDay.count) bestDay = day;
    }
    let bestMonth = "—";
    let bestMonthCount = -1;
    for (const [m, count] of byMonth) {
      if (count > bestMonthCount) {
        bestMonthCount = count;
        bestMonth = monthName(m);
      }
    }
    const { longest, current } = computeStreaks(seriesThroughToday);
    return {
      mostActiveMonth: bestMonthCount > 0 ? bestMonth : "—",
      mostActiveDay: bestDay.count > 0 ? formatMonthDay(bestDay.date) : "—",
      longest,
      current,
    };
  }, [seriesThroughToday]);

  const filters: { id: HeatFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "explore", label: "Explore" },
    { id: "full", label: "Full" },
  ];

  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"] as const;
  const weekCount = Math.max(weeks.length, 1);
  const cell = 13;
  const gap = 4;
  const dayColW = 22;

  return (
    <section className="rounded-2xl border border-black/8 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-black">AI Solves</h2>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-black tabular-nums">
            {loading ? "…" : total.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-black/10 bg-black/[0.03] p-0.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                filter === f.id
                  ? "bg-white text-black shadow-sm"
                  : "text-black/50 hover:text-black"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto pb-1">
        <div
          className="inline-block"
          style={{
            minWidth: dayColW + weekCount * (cell + gap),
          }}
        >
          <div
            className="relative mb-2"
            style={{
              height: 14,
              marginLeft: dayColW,
            }}
          >
            {monthLabels.map((m) => (
              <span
                key={`${m.label}-${m.index}`}
                className="absolute top-0 text-[11px] font-medium leading-none text-black/60"
                style={{ left: m.index * (cell + gap) }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex" style={{ gap }}>
            <div
              className="flex shrink-0 flex-col text-[11px] font-medium leading-none text-black/55"
              style={{ width: dayColW, gap }}
            >
              {dayLabels.map((d, i) => (
                <span
                  key={`${d}-${i}`}
                  className="flex items-center"
                  style={{ height: cell }}
                >
                  {d}
                </span>
              ))}
            </div>
            <div className="flex" style={{ gap }}>
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col" style={{ gap }}>
                  {Array.from({ length: 7 }, (_, di) => {
                    const day = week[di];
                    if (!day) {
                      return (
                        <div
                          key={`${wi}-${di}`}
                          className="rounded-[3px] bg-transparent"
                          style={{ width: cell, height: cell }}
                        />
                      );
                    }
                    const level = heatLevel(day.count, max);
                    return (
                      <div
                        key={day.date}
                        title={`${formatMonthDay(day.date)}: ${day.count} solve${day.count === 1 ? "" : "s"}`}
                        className={`rounded-[3px] ${HEAT_COLORS[level]}`}
                        style={{ width: cell, height: cell }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 border-t border-black/6 pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-black/45">Most Active Month</p>
          <p className="mt-1 text-sm font-semibold text-black">
            {stats.mostActiveMonth}
          </p>
        </div>
        <div>
          <p className="text-xs text-black/45">Most Active Day</p>
          <p className="mt-1 text-sm font-semibold text-black">
            {stats.mostActiveDay}
          </p>
        </div>
        <div>
          <p className="text-xs text-black/45">Longest Streak</p>
          <p className="mt-1 text-sm font-semibold text-black">
            {stats.longest}d
          </p>
        </div>
        <div>
          <p className="text-xs text-black/45">Current Streak</p>
          <p className="mt-1 text-sm font-semibold text-black">
            {stats.current}d
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-1.5 text-[11px] text-black/40">
        <span>Fewer</span>
        {HEAT_COLORS.map((c) => (
          <span key={c} className={`size-2.5 rounded-[2px] ${c}`} />
        ))}
        <span>More</span>
      </div>
    </section>
  );
}

export function OverviewPanel({ initial }: { initial: DashboardPayload }) {
  const { toast } = useToast();
  const { go } = useDashboardNav();
  const router = useRouter();
  const { data: live, refresh } = useDashboardData();
  const data = live ?? initial;
  const [busyPlan, setBusyPlan] = useState<string | null>(null);

  const currentPlanId = data.user.fullAccess ? data.user.plan : "free";
  // Higher tiers first in the upgrade row (like Cursor Pro+ / Ultra).
  const topPacks = [...PLAN_PACKS]
    .filter((p) => p.id !== currentPlanId)
    .reverse()
    .slice(0, 2);
  const currentPack = PLAN_PACKS.find((p) => p.id === currentPlanId);

  async function onBuy(planId: string) {
    setBusyPlan(planId);
    try {
      const result = await startPlanCheckout(planId);
      toast(
        result.endsAt
          ? `Payment successful — ${result.planLabel ?? planLabel(planId)} active until ${new Date(result.endsAt).toLocaleDateString("en-IN")}.`
          : "Payment successful. Access unlocked.",
        "success",
      );
      await refresh();
      router.refresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Checkout failed";
      if (text !== "Payment cancelled") toast(text, "error");
    } finally {
      setBusyPlan(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
          Overview
        </h1>
        <p className="mt-2 text-sm text-black/50">
          Plan status and recent interview activity.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {topPacks.map((pack) => (
          <div
            key={pack.id}
            className="flex flex-col rounded-2xl border border-black/8 bg-white p-5 sm:p-6"
          >
            <h3 className="text-[15px] font-semibold text-black">
              {pack.name}{" "}
              <span className="font-semibold text-black/80">{pack.priceLabel}</span>
            </h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-black/55">
              {pack.note}. Unlock full answers for every interview mode.
            </p>
            <LoadingButton
              type="button"
              loading={busyPlan === pack.id}
              loadingText="Opening…"
              onClick={() => onBuy(pack.id)}
              className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-black px-3.5 py-2.5 text-[13px] font-semibold text-white hover:bg-black/85 disabled:opacity-50"
            >
              Upgrade to {pack.name}
            </LoadingButton>
          </div>
        ))}
        {topPacks.length <= 1 ? (
          <div className="flex flex-col rounded-2xl border border-dashed border-black/10 bg-white/60 p-5 sm:p-6">
            <h3 className="text-[15px] font-semibold text-black">You&apos;re on the top plan</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-black/55">
              Manage billing anytime, or check usage for this account.
            </p>
            <Link
              href="/dashboard/billing"
              onClick={(e) => {
                e.preventDefault();
                go("/dashboard/billing");
              }}
              className="mt-5 inline-flex w-full items-center justify-center rounded-lg border border-black/15 px-3.5 py-2.5 text-[13px] font-semibold text-black hover:bg-black/[0.03]"
            >
              Open billing
            </Link>
          </div>
        ) : null}

        <div className="flex flex-col rounded-2xl border border-black/8 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-black">
              {currentPack
                ? `${currentPack.name} ${currentPack.priceLabel}`
                : data.user.planLabel}
            </h3>
            <span className="rounded-md bg-black/[0.06] px-2 py-0.5 text-[11px] font-medium text-black/55">
              Current
            </span>
          </div>
          <p className="mt-2 flex-1 text-sm leading-6 text-black/55">
            {data.user.fullAccess
              ? data.user.endsAt
                ? `Full access until ${new Date(data.user.endsAt).toLocaleDateString("en-IN")}. Adjust or renew anytime.`
                : "Full access on this account. Adjust or renew anytime."
              : `Free explore — ${data.user.exploreRemaining ?? 0} of ${FREE_EXPLORE_SOLVES} left (${FREE_FULL_SOLVES} full + ${FREE_PARTIAL_SOLVES} preview).`}
          </p>
          <Link
            href="/dashboard/billing"
            onClick={(e) => {
              e.preventDefault();
              go("/dashboard/billing");
            }}
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg border border-black/15 bg-white px-3.5 py-2.5 text-[13px] font-semibold text-black hover:bg-black/[0.03]"
          >
            Adjust Plan
          </Link>
        </div>
      </div>

      <ActivityHeatmap
        days={data.usageByDay}
        loading={data.usageByDay.length === 0}
      />
    </div>
  );
}
