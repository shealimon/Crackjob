"use client";

import { useState } from "react";
import { HelpArticle } from "@/components/help/help-article";
import { HelpSidebar } from "@/components/help/help-sidebar";
import type { HelpTopicContent } from "@/lib/help-content";
import { CloseIcon, MenuIcon } from "@/components/dashboard/icons";

export function HelpShell({ topic }: { topic: HelpTopicContent }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="dashboard-light flex min-h-screen bg-[var(--dash-bg)] text-[var(--dash-fg)]">
      <aside className="sticky top-0 hidden h-screen w-[252px] shrink-0 flex-col border-r border-black/8 bg-[var(--dash-sidebar)] lg:flex">
        <HelpSidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-black/8 bg-[var(--dash-sidebar)] px-4 lg:hidden">
          <p className="text-[15px] font-medium text-black">How it works</p>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg text-black/70 hover:bg-black/[0.05]"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <CloseIcon className="size-5" /> : <MenuIcon className="size-5" />}
          </button>
        </div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-30 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/20"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute left-0 top-14 flex h-[calc(100vh-3.5rem)] w-[min(300px,88vw)] flex-col border-r border-black/8 bg-[var(--dash-sidebar)] shadow-xl">
              <HelpSidebar onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 pt-14 lg:pt-0">
          <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
            <HelpArticle topic={topic} />
          </div>
        </main>
      </div>
    </div>
  );
}
