import { createHash, randomBytes } from "crypto";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function parseBearer(header: string | null) {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export function newDeviceId() {
  return randomBytes(16).toString("hex");
}
