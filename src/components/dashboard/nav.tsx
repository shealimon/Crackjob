"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

type DashboardNavValue = {
  /** Path used for active nav + panel (optimistic while soft-nav is in flight). */
  path: string;
  go: (href: string) => void;
};

const DashboardNavContext = createContext<DashboardNavValue | null>(null);

export function DashboardNavProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [optimistic, setOptimistic] = useState<string | null>(null);

  useEffect(() => {
    setOptimistic(null);
  }, [pathname]);

  const go = useCallback(
    (href: string) => {
      if (href === (optimistic ?? pathname)) return;
      // Instant panel switch — don't wait for the RSC round-trip.
      setOptimistic(href);
      router.push(href);
    },
    [optimistic, pathname, router],
  );

  return (
    <DashboardNavContext.Provider
      value={{ path: optimistic ?? pathname, go }}
    >
      {children}
    </DashboardNavContext.Provider>
  );
}

export function useDashboardNav() {
  const ctx = useContext(DashboardNavContext);
  if (!ctx) {
    throw new Error("useDashboardNav must be used within DashboardNavProvider");
  }
  return ctx;
}
