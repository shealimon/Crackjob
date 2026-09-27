import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getStealthStatus } from "../lib/tauri";

/**
 * While entire-screen share is active, the OS cursor is hidden over Crack
 * windows (so Meet does not show a floating pointer over "empty" space).
 * This paints a local-only pointer inside the WDA-excluded UI for the user.
 */
export function StealthLocalCursor() {
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [inside, setInside] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getStealthStatus()
      .then((status) => {
        if (!cancelled) setActive(Boolean(status.localCursorActive));
      })
      .catch(() => {});

    let unlisten: (() => void) | undefined;
    listen<{ active: boolean }>("stealth-local-cursor", (event) => {
      setActive(Boolean(event.payload?.active));
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (!active) {
      root.classList.remove("stealth-local-cursor");
      setInside(false);
      return;
    }

    root.classList.add("stealth-local-cursor");

    const onMove = (event: MouseEvent) => {
      setPos({ x: event.clientX, y: event.clientY });
      setInside(true);
    };
    const onLeave = () => setInside(false);

    window.addEventListener("mousemove", onMove);
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      root.classList.remove("stealth-local-cursor");
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, [active]);

  if (!active || !inside) return null;

  return (
    <div
      className="ic-stealth-cursor"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      aria-hidden
    />
  );
}
