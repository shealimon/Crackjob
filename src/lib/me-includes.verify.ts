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
assert(
  parseMeIncludes("shell,usage")?.join(",") === "shell,usage",
  "parse shell,usage",
);
assert(
  meQueryFromIncludes(["shell", "payments"]) === "/api/me?include=shell,payments",
  "me query",
);
assert(
  meIncludesForDashboardPath("/dashboard/settings")?.[0] === "shell",
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
