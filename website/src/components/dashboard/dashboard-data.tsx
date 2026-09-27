"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { signOut } from "next-auth/react";
import { useDashboardNav } from "@/components/dashboard/nav";
import type { DashboardPayload } from "@/lib/dashboard-data";
import {
  includesSatisfied,
  includesToSet,
  meIncludesForDashboardPath,
  meQueryFromIncludes,
  type MeInclude,
  ME_INCLUDE_ALL,
} from "@/lib/me-includes";
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

function mergeMePayload(
  prev: DashboardPayload | null,
  body: Record<string, unknown>,
): DashboardPayload {
  const next = asPayload(body);
  if (!prev) return next;
  const includes = (body.includes as MeInclude[] | undefined) ?? ME_INCLUDE_ALL;
  const inc = new Set(includes);
  return {
    user: next.user,
    profile: inc.has("shell") ? next.profile : prev.profile,
    desktopSession: inc.has("shell") ? next.desktopSession : prev.desktopSession,
    usageByDay: inc.has("usage") ? next.usageByDay : prev.usageByDay,
    usageEvents: inc.has("events") ? next.usageEvents : prev.usageEvents,
    payments: inc.has("payments") ? next.payments : prev.payments,
  };
}

async function fetchMe(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  return res;
}

export function DashboardDataProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial: DashboardPayload | null;
}) {
  const { path } = useDashboardNav();
  const [data, setData] = useState<DashboardPayload | null>(initial);
  const [loading, setLoading] = useState(!initial);
  const loadedIncludes = useRef<Set<MeInclude> | "all">(
    initial ? "all" : includesToSet("all"),
  );

  const fetchIncludes = useCallback(async (includes: MeInclude[] | "all") => {
    const res = await fetchMe(meQueryFromIncludes(includes));
    if (res.status === 401) {
      await signOut({ callbackUrl: "/login" });
      return;
    }
    if (!res.ok) return;
    const body = (await res.json()) as Record<string, unknown>;
    setData((prev) => mergeMePayload(prev, body));
    const returned = body.includes as MeInclude[] | undefined;
    loadedIncludes.current = returned
      ? includesToSet(returned)
      : includesToSet(includes);
  }, []);

  const refresh = useCallback(async () => {
    await fetchIncludes("all");
  }, [fetchIncludes]);

  useEffect(() => {
    if (initial) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const includes = meIncludesForDashboardPath(path);
        const res = await fetchMe(meQueryFromIncludes(includes));
        if (cancelled) return;
        if (res.status === 401) {
          await signOut({ callbackUrl: "/login" });
          return;
        }
        if (!res.ok) return;
        const body = (await res.json()) as Record<string, unknown>;
        if (!cancelled) {
          setData((prev) => mergeMePayload(prev, body));
          const returned = body.includes as MeInclude[] | undefined;
          loadedIncludes.current = returned
            ? includesToSet(returned)
            : includesToSet(includes);
        }
      } catch {
        // Keep null — DashboardView shows error after loading ends.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount fetch uses first path only
  }, [initial]);

  useEffect(() => {
    if (loading || initial) return;
    const needed = meIncludesForDashboardPath(path);
    if (includesSatisfied(loadedIncludes.current, needed)) return;
    void fetchIncludes(needed);
  }, [fetchIncludes, initial, loading, path]);

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
