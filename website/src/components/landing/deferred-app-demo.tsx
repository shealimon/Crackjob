"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const AppDemoSection = dynamic(
  () =>
    import("@/components/landing/app-demo-section").then((m) => ({
      default: m.AppDemoSection,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="mx-auto min-h-[28rem] w-full max-w-[90rem] px-3 md:min-h-[36rem]"
        aria-hidden
      />
    ),
  },
);

/** Hero paints first; the animated app demo waits for idle. */
export function DeferredAppDemo() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const enable = () => {
      if (!cancelled) setReady(true);
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(enable, { timeout: 350 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const id = setTimeout(enable, 1);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, []);

  if (!ready) {
    return (
      <div
        className="mx-auto min-h-[28rem] w-full max-w-[90rem] px-3 md:min-h-[36rem]"
        aria-hidden
      />
    );
  }

  return <AppDemoSection />;
}
