import {
  includesSatisfied,
  meIncludesForDashboardPath,
  meQueryFromIncludes,
  parseMeIncludes,
} from "@/lib/me-includes";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(parseMeIncludes(null) === "all", "null include → all");
const parsedShellUsage = parseMeIncludes("shell,usage");
assert(
  parsedShellUsage !== "all" &&
    parsedShellUsage.join(",") === "shell,usage",
  "parse shell,usage",
);
assert(
  meQueryFromIncludes(["shell", "payments"]) === "/api/me?include=shell,payments",
  "me query",
);
const settingsIncludes = meIncludesForDashboardPath("/dashboard/settings");
assert(
  settingsIncludes !== "all" && settingsIncludes[0] === "shell",
  "settings scope",
);
assert(
  includesSatisfied(new Set(["shell", "usage"]), ["shell", "usage"]),
  "satisfied partial",
);
assert(
  !includesSatisfied(new Set(["shell"]), ["shell", "events"]),
  "missing events",
);

console.log("me-includes.verify.ts: ok");
