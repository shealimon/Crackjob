"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { DashboardPayload } from "@/lib/dashboard-data";
import { planLabel } from "@/lib/plans";

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
  return {
    user: {
      ...user,
      planLabel: user.planLabel || planLabel(user.plan),
    },
    usageByDay: (body.usageByDay as DashboardPayload["usageByDay"]) ?? [],
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
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 401) {
          // Keep SSR shell if present; only bounce when we have no session data.
          if (!initial) {
            window.location.assign("/login?callbackUrl=/dashboard");
          }
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
