import { json, optionsCors } from "@/lib/http";
import { requireUser } from "@/lib/api-auth";
import { parseMeIncludes } from "@/lib/me-includes";
import { buildMePayload } from "@/lib/me-payload";

export function OPTIONS() {
  return optionsCors();
}

export async function GET(request: Request) {
  const authed = await requireUser(request);
  if ("error" in authed) {
    return json({ error: authed.error }, { status: authed.status });
  }

  const url = new URL(request.url);
  const includes = parseMeIncludes(url.searchParams.get("include"));
  const result = await buildMePayload(authed.userId, includes, authed.source);
  if ("error" in result) {
    return json({ error: result.error }, { status: result.status });
  }

  return json(result.body);
}
