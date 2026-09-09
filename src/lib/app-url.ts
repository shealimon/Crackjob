export function appBaseUrl() {
  const authUrl = process.env.AUTH_URL?.replace(/\/$/, "");
  // Never prefer a localhost AUTH_URL in production (common after .env import).
  if (
    authUrl &&
    !(
      process.env.NODE_ENV === "production" &&
      /localhost|127\.0\.0\.1/i.test(authUrl)
    )
  ) {
    return authUrl;
  }

  const publicUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (publicUrl) return publicUrl;

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/\/$/, "") ||
    process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercel) {
    return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  }

  return "http://localhost:43123";
}
