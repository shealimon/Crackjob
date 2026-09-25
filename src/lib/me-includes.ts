export type MeInclude = "shell" | "usage" | "events" | "payments";

export const ME_INCLUDE_ALL: MeInclude[] = ["shell", "usage", "events", "payments"];

export function parseMeIncludes(raw: string | null): MeInclude[] | "all" {
  if (!raw?.trim() || raw.trim().toLowerCase() === "full") {
    return "all";
  }
  const parts = raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const set = new Set<MeInclude>();
  for (const part of parts) {
    if (
      part === "shell" ||
      part === "usage" ||
      part === "events" ||
      part === "payments"
    ) {
      set.add(part);
    }
  }
  if (set.size === 0) return "all";
  return [...set];
}

export function meIncludesForDashboardPath(pathname: string): MeInclude[] | "all" {
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  if (path === "/dashboard/settings") return ["shell"];
  if (path === "/dashboard/billing") return ["shell", "payments"];
  if (path === "/dashboard/usage") return "all";
  if (path.startsWith("/dashboard")) return ["shell", "usage", "payments"];
  return "all";
}

export function includesSatisfied(
  loaded: Set<MeInclude> | "all",
  needed: MeInclude[] | "all",
): boolean {
  if (needed === "all") return loaded === "all";
  if (loaded === "all") return true;
  return needed.every((part) => loaded.has(part));
}

export function includesToSet(value: MeInclude[] | "all"): Set<MeInclude> | "all" {
  if (value === "all") return "all";
  return new Set(value);
}

export function meQueryFromIncludes(includes: MeInclude[] | "all"): string {
  if (includes === "all") return "/api/me";
  return `/api/me?include=${includes.join(",")}`;
}
