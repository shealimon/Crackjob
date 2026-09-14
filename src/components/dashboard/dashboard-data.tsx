"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { signOut } from "next-auth/react";
import type { DashboardPayload } from "@/lib/dashboard-data";
import { planLabel } from "@/lib/plans";
import { toPublicProfile } from "@/lib/profile";

type DashboardDataContextValue = {
  data: DashboardPayload | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const DashboardDataContext = createContext<DashboardDataContextValue | null>(
  null,
);

function asPayload(body: Record<string, unknown>): DashboardPayload {
  const user = body.user as DashboardPayload["user"];
  const profile = body.profile as DashboardPayload["profile"] | undefined;
  return {
    user: {
      ...user,
      planLabel: user.planLabel || planLabel(user.plan),
    },
    usageByDay: (
      ((body.usageByDay as DashboardPayload["usageByDay"]) ?? []).map((d) => ({
        date: d.date,
        creditsUsed: d.creditsUsed ?? 0,
        solves: d.solves ?? 0,
        exploreSolves: d.exploreSolves ?? 0,
        fullSolves: d.fullSolves ?? 0,
      }))
    ),
    usageEvents: (body.usageEvents as DashboardPayload["usageEvents"]) ?? [],
    payments: (body.payments as DashboardPayload["payments"]) ?? [],
    profile: profile ?? toPublicProfile(null),
    desktopSession:
      (body.desktopSession as DashboardPayload["desktopSession"]) ?? null,
  };
}

export function DashboardDataProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial: DashboardPayload | null;
}) {
  const [data, setData] = useState<DashboardPayload | null>(initial);
  const [loading, setLoading] = useState(!initial);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/me", { cache: "no-store" });
    if (!res.ok) return;
    const body = (await res.json()) as Record<string, unknown>;
    setData(asPayload(body));
  }, []);

  useEffect(() => {
    // SSR shell already has user + desktop — don't block overview with /api/me.
    // Usage pages call refresh() when they need the 14-day series.
    if (initial) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 401) {
          await signOut({ callbackUrl: "/login" });
          return;
        }
        if (!res.ok) return;
        const body = (await res.json()) as Record<string, unknown>;
        if (!cancelled) setData(asPayload(body));
      } catch {
        // Keep initial SSR payload if refresh fails.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initial]);

  const value = useMemo(
    () => ({ data, loading, refresh }),
    [data, loading, refresh],
  );

  return (
    <DashboardDataContext.Provider value={value}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    throw new Error("useDashboardData must be used within DashboardDataProvider");
  }
  return ctx;
}
