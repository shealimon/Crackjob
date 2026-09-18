/** Auth forms that match login — no top AppHeader; home via form logo only. */
export function isBareAuthPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.replace(/\/$/, "") || "/";
  return (
    path === "/login" ||
    path === "/signup" ||
    path === "/forgot-password" ||
    path === "/reset-password"
  );
}
