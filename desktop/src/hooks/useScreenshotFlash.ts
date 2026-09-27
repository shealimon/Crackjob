import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";

/** Plays once per successful Ctrl+H capture. Token remounts CSS animations. */
export function useScreenshotFlash(durationMs = 320) {
  const [token, setToken] = useState(0);
  const genRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const unlisten = listen("screenshot-captured", () => {
      if (cancelled) return;
      const next = genRef.current + 1;
      genRef.current = next;
      setToken(next);
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (genRef.current === next) setToken(0);
      }, durationMs);
    });

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      void unlisten.then((fn) => fn());
    };
  }, [durationMs]);

  return token;
}
