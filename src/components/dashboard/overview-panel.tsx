"use client";

import Link from "next/link";
import { useState } from "react";
import { LoadingButton } from "@/components/loading-button";
import { useToast } from "@/components/toast";
import { PLAN_PACKS } from "@/lib/constants";
import type { DashboardPayload } from "@/lib/dashboard-data";

export function OverviewPanel({ initial }: { initial: DashboardPayload }) {
  const { toast } = useToast();
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);

  const steps = [
    {
      id: "download",
      title: "Download the Windows app",
      done: false,
      body: "Install Crack on Windows. The website is only for plan and usage.",
      href: "/download",
      cta: "Download",
    },
    {
      id: "desktop",
      title: "Sign in on desktop",
      done: Boolean(data.desktopSession),
      body: "Open the app and sign in with the same email. It stays logged in for interviews.",
      href: "/download",
      cta: data.desktopSession ? "Connected" : "Open download",
    },
    {
      id: "try",
      title: "Try a free explore solve",
      done: data.user.solvesToday > 0 || data.user.fullAccess,
      body: data.user.fullAccess
        ? "You have full access — use the overlay during interviews."
        : `${data.user.exploreRemaining ?? 0} free solves left today.`,
      href: "/download",
      cta: "Get started",
    },
    {
      id: "plan",
      title: "Pick a full-access plan",
      done: data.user.fullAccess,
      body: "Unlock full answers with 1 month, 3 months, or yearly.",
      href: "/dashboard/billing",
      cta: data.user.fullAccess ? "View plan" : "See billing",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const [expanded, setExpanded] = useState(
    () => steps.find((s) => !s.done)?.id ?? steps[0].id,
  );

  async function revoke() {
    setBusy(true);
    try {
      const res = await fetch("/api/session/desktop", { method: "DELETE" });
      if (!res.ok) {
        toast("Could not revoke the desktop session.", "error");
        return;
      }
      const me = await fetch("/api/me");
      if (me.ok) {
        const body = (await me.json()) as DashboardPayload;
        setData({
          ...body,
          user: { ...body.user, planLabel: body.user.planLabel || data.user.planLabel },
        });
      } else {
        setData((prev) => ({ ...prev, desktopSession: null }));
      }
      toast("Desktop session revoked.", "success");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
          Overview
        </h1>
      </div>

      <section className="rounded-2xl border border-black/8 bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-black">Getting started</h2>
          <p className="text-xs text-black/45">
            {doneCount}/{steps.length} completed
          </p>
        </div>
        <ul className="mt-4 divide-y divide-black/6">
          {steps.map((step) => {
            const open = expanded === step.id;
            return (
              <li key={step.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 py-3.5 text-left"
                  onClick={() => setExpanded(open ? "" : step.id)}
                >
                  <span
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[10px] ${
                      step.done
                        ? "border-black bg-black text-white"
                        : "border-black/25 text-transparent"
                    }`}
                  >
                    {step.done ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm font-medium ${
                        step.done ? "text-black/45 line-through" : "text-black"
                      }`}
                    >
                      {step.title}
                    </span>
                    {open ? (
                      <span className="mt-2 block space-y-3">
                        <span className="block text-sm leading-6 text-black/55">
                          {step.body}
                        </span>
                        <Link
                          href={step.href}
                          className="inline-flex rounded-lg bg-black px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-black/85"
                        >
                          {step.cta}
                        </Link>
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PLAN_PACKS.map((pack) => {
          const current = data.user.plan === pack.id;
          return (
            <div
              key={pack.id}
              className={`rounded-2xl border p-5 ${
                current
                  ? "border-black/20 bg-white"
                  : "border-black/8 bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-black">{pack.name}</h3>
                {current ? (
                  <span className="rounded-full bg-black/6 px-2 py-0.5 text-[11px] font-medium text-black/60">
                    Current
                  </span>
                ) : "featured" in pack && pack.featured ? (
                  <span className="rounded-full bg-black px-2 py-0.5 text-[11px] font-medium text-white">
                    Popular
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-black">
                {pack.priceLabel}
              </p>
              <p className="mt-2 text-sm leading-6 text-black/55">{pack.note}</p>
              <Link
                href="/dashboard/billing"
                className={`mt-5 inline-flex w-full items-center justify-center rounded-lg px-3.5 py-2.5 text-[13px] font-semibold ${
                  current
                    ? "border border-black/15 text-black hover:bg-black/[0.03]"
                    : "bg-black text-white hover:bg-black/85"
                }`}
              >
                {current ? "Manage" : "Upgrade"}
              </Link>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-black/8 bg-white p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-black/40">
            Current plan
          </p>
          <p className="mt-2 text-xl font-semibold text-black">{data.user.planLabel}</p>
          <p className="mt-2 text-sm leading-6 text-black/55">
            {data.user.fullAccess
              ? data.user.endsAt
                ? `Full access until ${new Date(data.user.endsAt).toLocaleDateString("en-IN")}`
                : "Full access"
              : `Free explore — ${data.user.exploreRemaining ?? 0} solves left today (${data.user.solvesToday} used)`}
          </p>
        </div>

        <div className="rounded-2xl border border-black/8 bg-white p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-black/40">
            Windows app
          </p>
          {data.desktopSession ? (
            <>
              <p className="mt-2 text-xl font-semibold text-black">
                {data.desktopSession.deviceName || "Connected"}
              </p>
              <p className="mt-2 text-sm text-black/55">
                Last seen{" "}
                {new Date(data.desktopSession.lastSeenAt).toLocaleString("en-IN")}
              </p>
              <LoadingButton
                type="button"
                loading={busy}
                loadingText="Revoking…"
                onClick={revoke}
                className="mt-4 rounded-lg border border-black/15 px-3.5 py-2 text-[13px] font-semibold text-black hover:bg-black/[0.03] disabled:opacity-50"
              >
                Revoke session
              </LoadingButton>
            </>
          ) : (
            <>
              <p className="mt-2 text-xl font-semibold text-black">Not signed in</p>
              <p className="mt-2 text-sm leading-6 text-black/55">
                Sign in once in the Windows app with the same email.
              </p>
              <Link
                href="/download"
                className="mt-4 inline-flex rounded-lg bg-black px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-black/85"
              >
                Download app
              </Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
