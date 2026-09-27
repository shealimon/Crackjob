import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingText?: ReactNode;
};

export function LoadingButton({
  loading = false,
  loadingText,
  children,
  className = "",
  disabled,
  type = "button",
  ...props
}: LoadingButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <Spinner />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Compact placeholder while Suspense resolves search params / auth forms. */
export function AuthFormFallback() {
  return (
    <div className="flex w-full max-w-[400px] flex-col items-center justify-center py-16">
      <Spinner className="size-6 text-accent" />
      <p className="mt-4 text-sm text-white/45">Loading…</p>
    </div>
  );
}
