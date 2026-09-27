/**
 * Single authoritative latest-screenshot slot (Interactive / Ctrl+H / Ctrl+Enter).
 * Out-of-order async captures cannot replace a newer committed image.
 */
import { isValidCapturePayload } from "./interactiveCapture";

export type ActiveScreenshotController = {
  /** Monotonic id assigned at each capture start. */
  nextGeneration: number;
  /** Generations below this are ignored (Start Over / Stop / session reset). */
  minValidGeneration: number;
  /** Highest generation successfully committed to the active slot. */
  committedGeneration: number;
  activeImageBase64: string | null;
  /** In-flight capture chain — await before Ctrl+Enter solve. */
  tail: Promise<void>;
  /** Resolvers for global Ctrl+H (capture-started → capture-ready) barriers. */
  rustCaptureWaitResolvers: Array<() => void>;
  /** Generations reserved on each capture-started (paired on capture-ready). */
  rustInflightGenerations: number[];
};

export function createActiveScreenshotController(): ActiveScreenshotController {
  return {
    nextGeneration: 0,
    minValidGeneration: 1,
    committedGeneration: 0,
    activeImageBase64: null,
    tail: Promise.resolve(),
    rustCaptureWaitResolvers: [],
    rustInflightGenerations: [],
  };
}

function abortAllRustCaptureWaits(controller: ActiveScreenshotController): void {
  while (controller.rustCaptureWaitResolvers.length > 0) {
    controller.rustCaptureWaitResolvers.shift()?.();
  }
  controller.rustInflightGenerations = [];
}

/** Full reset for unit tests. */
export function clearActiveScreenshotController(
  controller: ActiveScreenshotController,
): void {
  abortAllRustCaptureWaits(controller);
  controller.nextGeneration = 0;
  controller.minValidGeneration = 1;
  controller.committedGeneration = 0;
  controller.activeImageBase64 = null;
  controller.tail = Promise.resolve();
}

/**
 * Invalidate in-flight and committed screenshots (Ctrl+G, Stop, Start Interview).
 * Late async completions cannot commit after this.
 */
export function invalidateActiveScreenshotSession(
  controller: ActiveScreenshotController,
): void {
  abortAllRustCaptureWaits(controller);
  controller.nextGeneration += 1;
  controller.minValidGeneration = controller.nextGeneration + 1;
  controller.nextGeneration = controller.minValidGeneration;
  controller.committedGeneration = controller.minValidGeneration - 1;
  controller.activeImageBase64 = null;
  controller.tail = Promise.resolve();
}

export function beginActiveCaptureGeneration(
  controller: ActiveScreenshotController,
): number {
  controller.nextGeneration += 1;
  return controller.nextGeneration;
}

/**
 * Commit a completed capture. Rejects stale generations (late async completion).
 */
export function commitActiveScreenshot(
  controller: ActiveScreenshotController,
  generation: number,
  imageBase64: string,
): boolean {
  if (!isValidCapturePayload(imageBase64)) {
    return false;
  }
  if (generation < controller.minValidGeneration) {
    return false;
  }
  if (generation <= controller.committedGeneration) {
    return false;
  }
  controller.committedGeneration = generation;
  controller.activeImageBase64 = imageBase64;
  return true;
}

/** Programmatic / dedupe capture-ready without capture-started. */
export function commitActiveScreenshotExternal(
  controller: ActiveScreenshotController,
  imageBase64: string,
): { generation: number; accepted: boolean } {
  const generation = beginActiveCaptureGeneration(controller);
  const accepted = commitActiveScreenshot(controller, generation, imageBase64);
  return { generation, accepted };
}

export function getActiveScreenshot(
  controller: ActiveScreenshotController,
): string | null {
  return controller.activeImageBase64;
}

export function getCommittedScreenshotGeneration(
  controller: ActiveScreenshotController,
): number {
  return controller.committedGeneration;
}

export async function flushActiveScreenshotCaptures(
  controller: ActiveScreenshotController,
): Promise<void> {
  await controller.tail;
}

/** Wait for captures, then read the latest committed frame (authoritative for solves). */
export async function resolveLatestCommittedScreenshot(
  controller: ActiveScreenshotController,
): Promise<{ imageBase64: string | null; generation: number }> {
  await flushActiveScreenshotCaptures(controller);
  return {
    imageBase64: controller.activeImageBase64,
    generation: controller.committedGeneration,
  };
}

/**
 * After flush, apply Rust solve-request payload only if the slot is still empty.
 */
export function adoptRustSolveScreenshotIfNeeded(
  controller: ActiveScreenshotController,
  imageBase64: string | null | undefined,
): boolean {
  if (!imageBase64 || !isValidCapturePayload(imageBase64)) {
    return false;
  }
  if (getActiveScreenshot(controller)) {
    return false;
  }
  return commitActiveScreenshotExternal(controller, imageBase64).accepted;
}

/**
 * Global hotkey Ctrl+H: Rust emits capture-started before the bitmap is ready.
 */
export function beginRustCaptureInFlight(
  controller: ActiveScreenshotController,
): number {
  const generation = beginActiveCaptureGeneration(controller);
  controller.rustInflightGenerations.push(generation);
  const wait = new Promise<void>((resolve) => {
    controller.rustCaptureWaitResolvers.push(resolve);
  });
  controller.tail = controller.tail
    .then(
      () => wait,
      () => wait,
    )
    .then(
      () => undefined,
      () => undefined,
    );
  return generation;
}

/** capture-ready: commit reserved generation, then release barrier. */
export function completeRustCaptureInFlight(
  controller: ActiveScreenshotController,
  imageBase64: string,
): { generation: number; accepted: boolean } {
  const pendingWaiters = controller.rustCaptureWaitResolvers.length;
  let reserved: number | null = null;
  if (controller.rustInflightGenerations.length > 0) {
    // One physical capture may follow multiple capture-started (double hotkey) — pair with latest.
    reserved =
      controller.rustInflightGenerations[
        controller.rustInflightGenerations.length - 1
      ] ?? null;
    controller.rustInflightGenerations = [];
  }

  let generation = reserved ?? 0;
  let accepted = false;
  if (reserved != null) {
    if (
      controller.activeImageBase64 &&
      controller.activeImageBase64 === imageBase64
    ) {
      // Same-frame recapture (or Rust dedupe replay). Capture is finished — do not
      // leave Ctrl+Enter blocked waiting for a later ready that will never come.
      while (controller.rustCaptureWaitResolvers.length > 0) {
        controller.rustCaptureWaitResolvers.shift()?.();
      }
      return { generation: reserved, accepted: false };
    }
    accepted = commitActiveScreenshot(controller, reserved, imageBase64);
  } else if (pendingWaiters === 0) {
    const external = commitActiveScreenshotExternal(controller, imageBase64);
    generation = external.generation;
    accepted = external.accepted;
  } else {
    // Rust 120ms dedupe can emit capture-ready without capture-started while a real capture is in flight.
    return { generation: 0, accepted: false };
  }

  while (controller.rustCaptureWaitResolvers.length > 0) {
    controller.rustCaptureWaitResolvers.shift()?.();
  }
  return { generation, accepted };
}

/** capture-error: drop barrier without changing the active slot. */
export function abortRustCaptureInFlight(
  controller: ActiveScreenshotController,
): void {
  controller.rustInflightGenerations.pop();
  controller.rustCaptureWaitResolvers.shift()?.();
}

/**
 * Run one serialized capture; generation is assigned when this call is scheduled.
 */
export function runActiveScreenshotCapture(
  controller: ActiveScreenshotController,
  work: (generation: number) => Promise<{ imageBase64: string } | null>,
): Promise<string | null> {
  const generation = beginActiveCaptureGeneration(controller);

  const run = async (): Promise<string | null> => {
    let shot: { imageBase64: string } | null = null;
    try {
      shot = await work(generation);
    } catch {
      return null;
    }
    if (!shot) {
      return null;
    }
    if (!commitActiveScreenshot(controller, generation, shot.imageBase64)) {
      return getActiveScreenshot(controller);
    }
    return shot.imageBase64;
  };

  const promise = controller.tail.then(run, run);
  controller.tail = promise.then(
    () => undefined,
    () => undefined,
  );
  return promise;
}
