import { SITE_URL } from "@/lib/seo";

function isLocalHost(url: string) {
  return /localhost|127\.0\.0\.1/i.test(url);
}

function isLegacyHost(url: string) {
  return /porpin\.com/i.test(url);
}

function isUsableOrigin(url: string) {
  if (isLegacyHost(url)) return false;
  if (isProductionRuntime() && isLocalHost(url)) return false;
  return true;
}

function isProductionRuntime() {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

/**
 * App origin for cookies, Auth.js, and Supabase email links.
 * - Development: AUTH_URL / localhost:43123
 * - Production (live): https://crackjob.co (never localhost / never porpin.com)
 */
export function appBaseUrl() {
  const authUrl = process.env.AUTH_URL?.replace(/\/$/, "");
  if (authUrl && isUsableOrigin(authUrl)) {
    return authUrl;
  }

  const publicUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (publicUrl && isUsableOrigin(publicUrl)) {
    return publicUrl;
  }

  if (isProductionRuntime()) {
    return SITE_URL;
  }

  return "http://localhost:43123";
}

/** Same as appBaseUrl — email redirects follow the current environment. */
export function authEmailBaseUrl() {
  return appBaseUrl();
}

/** Full Supabase emailRedirectTo / redirectTo for /auth/callback. */
export function authEmailCallbackUrl(nextPath: string) {
  const next = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  return `${authEmailBaseUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}
