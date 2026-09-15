import { Spinner } from "@/components/loading-button";

/** Centered spinner while a dashboard panel fetches its data. */
export function PanelLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[min(420px,55vh)] flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Spinner className="size-7 text-black/45" />
      <p className="text-sm text-black/45">{label}</p>
    </div>
  );
}
