import { useEffect, useRef } from "react";
import { moveAppWindows } from "../lib/tauri";
import { scrollDeltaForArrow } from "../lib/scroll";

type HotkeyHandlers = {
  onCapture?: () => void;
  onSolve?: () => void;
  onToggle?: () => void;
  onReset?: () => void;
  onHistory?: () => void;
};

const MOVE_STEP = 24;
const REPEAT_MS = 50;
const REPEAT_INITIAL_DELAY_MS = 200;

function getMoveDelta(code: string): { dx: number; dy: number } | null {
  switch (code) {
    case "ArrowUp":
      return { dx: 0, dy: -MOVE_STEP };
    case "ArrowDown":
      return { dx: 0, dy: MOVE_STEP };
    case "ArrowLeft":
      return { dx: -MOVE_STEP, dy: 0 };
    case "ArrowRight":
      return { dx: MOVE_STEP, dy: 0 };
    default:
      return null;
  }
}

function isModKey(event: KeyboardEvent) {
  return event.ctrlKey || event.metaKey;
}

function isKeyH(event: KeyboardEvent) {
  return event.code === "KeyH" || event.key.toLowerCase() === "h";
}

function isKeyB(event: KeyboardEvent) {
  return event.code === "KeyB" || event.key.toLowerCase() === "b";
}

function isKeyG(event: KeyboardEvent) {
  return event.code === "KeyG" || event.key.toLowerCase() === "g";
}

function isKeyY(event: KeyboardEvent) {
  return event.code === "KeyY" || event.key.toLowerCase() === "y";
}

function isEnter(event: KeyboardEvent) {
  return (
    event.code === "Enter" ||
    event.code === "NumpadEnter" ||
    event.key === "Enter" ||
    event.key === "NumpadEnter"
  );
}

export function useWindowHotkeys(handlers: HotkeyHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let repeatInitialTimer: number | null = null;
    let repeatInterval: number | null = null;
    let activeRepeatKey: string | null = null;

    const clearRepeat = () => {
      if (repeatInitialTimer != null) {
        window.clearTimeout(repeatInitialTimer);
        repeatInitialTimer = null;
      }
      if (repeatInterval != null) {
        window.clearInterval(repeatInterval);
        repeatInterval = null;
      }
      activeRepeatKey = null;
    };

    const startMoveRepeat = (delta: { dx: number; dy: number }, code: string) => {
      if (activeRepeatKey === code) return;

      clearRepeat();
      activeRepeatKey = code;
      void moveAppWindows(delta.dx, delta.dy).catch(() => undefined);

      repeatInitialTimer = window.setTimeout(() => {
        repeatInterval = window.setInterval(() => {
          void moveAppWindows(delta.dx, delta.dy).catch(() => undefined);
        }, REPEAT_MS);
      }, REPEAT_INITIAL_DELAY_MS);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isModKey(event) || event.altKey) return;

      const { onCapture, onSolve, onToggle, onReset, onHistory } = handlersRef.current;

      // Ctrl+Shift+Arrows (scroll) are handled by the global shortcut plugin so
      // they work when focus is outside the app. Skip here to avoid double-scroll.
      if (event.shiftKey && scrollDeltaForArrow(event.code)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const moveDelta = getMoveDelta(event.code);
      if (moveDelta && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) {
          startMoveRepeat(moveDelta, event.code);
        }
        return;
      }

      if (isKeyH(event) && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) onCapture?.();
      } else if (isKeyB(event) && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) onToggle?.();
      } else if (isEnter(event) && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) onSolve?.();
      } else if (isKeyG(event) && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) onReset?.();
      } else if (isKeyY(event) && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) onHistory?.();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (getMoveDelta(event.code) && activeRepeatKey === event.code) {
        clearRepeat();
        return;
      }

      const key = event.key.toLowerCase();
      if ((key === "control" || key === "meta") && activeRepeatKey) {
        clearRepeat();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      clearRepeat();
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, []);
}
