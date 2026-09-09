"use client";

import { useState } from "react";
import { LoadingButton } from "@/components/loading-button";
import { useToast } from "@/components/toast";
import type { DashboardPayload } from "@/lib/dashboard-data";

export function SettingsPanel({ initial }: { initial: DashboardPayload }) {
  const { toast } = useToast();
  const [desktopSession, setDesktopSession] = useState(initial.desktopSession);
  const [busy, setBusy] = useState(false);
  const user = initial.user;

  async function revoke() {
    setBusy(true);
    try {
      const res = await fetch("/api/session/desktop", { method: "DELETE" });
      if (!res.ok) {
        toast("Could not revoke the desktop session.", "error");
        return;
      }
      setDesktopSession(null);
      toast("Desktop session revoked. Sign in again from the Windows app.", "success");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
          Settings
        </h1>
        <p className="mt-2 text-sm text-black/50">
          Account details and connected devices.
        </p>
      </div>

      <section className="rounded-2xl border border-black/8 bg-white p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-black">Account</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-black/45">Name</dt>
            <dd className="mt-1 text-sm font-medium text-black">
              {user.name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-black/45">Email</dt>
            <dd className="mt-1 text-sm font-medium text-black">
              {user.email || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-black/45">Plan</dt>
            <dd className="mt-1 text-sm font-medium text-black">{user.planLabel}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-black/8 bg-white p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-black">Desktop session</h2>
        <p className="mt-2 text-sm leading-6 text-black/55">
          The Windows overlay stays signed in until you revoke it here or sign
          out in the app.
        </p>
        {desktopSession ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-black">
              {desktopSession.deviceName || "Windows overlay"}
            </p>
            <p className="mt-1 text-xs text-black/45">
              Last seen{" "}
              {new Date(desktopSession.lastSeenAt).toLocaleString("en-IN")}
            </p>
            <LoadingButton
              type="button"
              loading={busy}
              loadingText="Revoking…"
              onClick={revoke}
              className="mt-4 rounded-lg border border-red-200 px-3.5 py-2 text-[13px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Revoke session
            </LoadingButton>
          </div>
        ) : (
          <p className="mt-4 text-sm text-black/55">No active desktop session.</p>
        )}
      </section>
    </div>
  );
}
