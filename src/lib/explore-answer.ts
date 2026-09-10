import {
  FREE_EXPLORE_SOLVES,
  FREE_FULL_SOLVES,
  FREE_PARTIAL_UPGRADE_MSG,
} from "@/lib/plans";
import type { SolveResult } from "@/lib/prompts";

export type FreeAnswerTier = "full" | "partial" | "blocked";

/** Tier for the *next* solve given lifetime explore usage. */
export function freeAnswerTier(exploreUsed: number): FreeAnswerTier {
  if (exploreUsed < FREE_FULL_SOLVES) return "full";
  if (exploreUsed < FREE_EXPLORE_SOLVES) return "partial";
  return "blocked";
}

/** Keep roughly the first half of the answer; avoid cutting mid-word. */
export function clipTextHalf(text: string, final = true): string {
  const t = text;
  if (t.length <= 1) return t;

  let cut = Math.floor(t.length / 2);
  const minCut = Math.floor(t.length * 0.4);
  while (cut > minCut && cut < t.length && !/\s/.test(t[cut] ?? "")) {
    cut -= 1;
  }

  const clipped = t.slice(0, cut).trimEnd();
  return final ? `${clipped}\n\n…` : clipped;
}

export function clipSolveResultHalf(result: SolveResult, final = true): SolveResult {
  const halfList = <T,>(items: T[]) =>
    items.length <= 1 ? items : items.slice(0, Math.ceil(items.length / 2));

  return {
    ...result,
    solution: clipTextHalf(result.solution, final),
    approach: halfList(result.approach),
    talkingPoints: halfList(result.talkingPoints),
    // Teaser tier: hide the rest so upgrade is required for the full pack.
    followUps: final ? [] : halfList(result.followUps),
    pitfalls: final ? [] : halfList(result.pitfalls),
  };
}

export function applyFreeAnswerGate(
  result: SolveResult,
  tier: FreeAnswerTier,
  final = true,
): { result: SolveResult; partialAnswer: boolean; upgradePrompt: string | null } {
  if (tier !== "partial") {
    return { result, partialAnswer: false, upgradePrompt: null };
  }
  return {
    result: clipSolveResultHalf(result, final),
    partialAnswer: true,
    upgradePrompt: FREE_PARTIAL_UPGRADE_MSG,
  };
}
