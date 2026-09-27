const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function json<T>(data: T, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return Response.json(data, { ...init, headers });
}

export function optionsCors() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export const options = optionsCors;

export function ndjsonStream(
  handler: (send: (payload: Record<string, unknown>) => void) => Promise<void>,
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };
      try {
        await handler(send);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Stream failed";
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  const headers = new Headers(CORS_HEADERS);
  headers.set("Content-Type", "application/x-ndjson; charset=utf-8");
  headers.set("Cache-Control", "no-cache, no-transform");
  headers.set("Connection", "keep-alive");
  headers.set("X-Accel-Buffering", "no");

  return new Response(stream, { headers });
}
