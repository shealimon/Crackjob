"use client";

/**
 * Calendar year in the user's browser — updates when the year changes without redeploying the site.
 */
export function CurrentYear() {
  return (
    <span suppressHydrationWarning>{new Date().getFullYear()}</span>
  );
}
