"use client";

import type { DashboardPayload } from "@/lib/dashboard-data";

export function UsagePanel({ initial }: { initial: DashboardPayload }) {
  const { user, usageByDay } = initial;
  const maxUsage = Math.max(1, ...usageByDay.map((d) => d.creditsUsed));
  const total = usageByDay.reduce((sum, d) => sum + d.creditsUsed, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
          Usage
        </h1>
        <p className="mt-2 text-sm text-black/50">
          AI token usage over the last 14 days (input + output).
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-black/8 bg-white p-5">
          <p className="text-xs text-black/45">Credits (14 days)</p>
          <p className="mt-2 text-2xl font-semibold text-black">
            {total.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-2xl border border-black/8 bg-white p-5">
          <p className="text-xs text-black/45">Solves today</p>
          <p className="mt-2 text-2xl font-semibold text-black">
            {user.solvesToday}
          </p>
        </div>
        <div className="rounded-2xl border border-black/8 bg-white p-5">
          <p className="text-xs text-black/45">
            {user.fullAccess ? "Access" : "Explore left today"}
          </p>
          <p className="mt-2 text-2xl font-semibold text-black">
            {user.fullAccess ? "Full" : user.exploreRemaining ?? 0}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-black/8 bg-white p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-black">Last 14 days</h2>
        <div className="mt-6 flex h-44 items-end gap-1.5">
          {usageByDay.map((day) => (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-md bg-black/80"
                style={{
                  height: `${Math.max(4, (day.creditsUsed / maxUsage) * 100)}%`,
                  opacity: day.creditsUsed ? 1 : 0.18,
                }}
                title={`${day.date}: ${day.creditsUsed.toLocaleString("en-IN")} credits`}
              />
              <span className="text-[10px] text-black/40">{day.date.slice(8)}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-black/45">
          Credits are for visibility — not a monthly wallet balance.
        </p>
      </section>
    </div>
  );
}
