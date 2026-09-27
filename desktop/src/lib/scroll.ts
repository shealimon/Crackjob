export const SCROLL_STEP = 80;

export function scrollElement(el: HTMLElement, dx: number, dy: number) {
  el.scrollBy({ left: dx, top: dy, behavior: "auto" });
}

export function scrollDeltaForArrow(code: string): { dx: number; dy: number } | null {
  switch (code) {
    case "ArrowUp":
      return { dx: 0, dy: -SCROLL_STEP };
    case "ArrowDown":
      return { dx: 0, dy: SCROLL_STEP };
    case "ArrowLeft":
      return { dx: -SCROLL_STEP, dy: 0 };
    case "ArrowRight":
      return { dx: SCROLL_STEP, dy: 0 };
    default:
      return null;
  }
}
