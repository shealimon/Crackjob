/** How it works — match dashboard panels (usage, settings, etc.). */
export const hiw = {
  pageTitle: "text-2xl font-semibold tracking-tight text-black sm:text-3xl",
  pageSubtitle: "mt-2 max-w-2xl text-sm leading-6 text-black/55",
  card: "rounded-2xl border border-black/10 bg-white p-5 sm:p-6",
  body: "text-sm leading-6 text-black/55",
  bodyStrong: "text-sm font-semibold text-black",
  link: "font-medium text-black/55 underline decoration-black/20 underline-offset-2 hover:text-black hover:decoration-black/40",
  note: "mt-4 text-sm leading-6 text-black/55",
  stepNum:
    "grid size-7 shrink-0 place-items-center rounded-full border border-black/10 bg-[var(--dash-bg)] text-xs font-semibold text-black/55",
  stepTitle: "text-sm font-semibold text-black",
  tableWrap: "overflow-hidden rounded-xl border border-black/10",
  tableHead: "px-3 py-2 text-xs font-medium text-black/55",
  tableCell: "px-3 py-2.5 text-sm text-black/55",
  tableHeadRow: "border-b border-black/8 bg-[var(--dash-bg)]",
  tableRow: "border-b border-black/6 last:border-0",
  kbd: "inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-black/10 bg-[var(--dash-bg)] px-1.5 py-0.5 font-mono text-[11px] font-medium text-black/55",
  chip: "inline-flex items-center rounded-md border border-black/10 bg-[var(--dash-bg)] px-2 py-0.5 text-[12px] font-medium text-black/70",
} as const;
