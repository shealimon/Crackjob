"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { BrandMark } from "@/components/brand-mark";
import {
  BillingIcon,
  CloseIcon,
  DownloadIcon,
  HelpIcon,
  LogoutIcon,
  MenuIcon,
  MoreIcon,
  OverviewIcon,
  SettingsIcon,
  SpendingIcon,
  UsageIcon,
} from "@/components/dashboard/icons";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: OverviewIcon, exact: true },
  { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
  { href: "/dashboard/usage", label: "Usage", icon: UsageIcon },
  { href: "/dashboard/spending", label: "Spending", icon: SpendingIcon },
  { href: "/dashboard/billing", label: "Billing & Invoices", icon: BillingIcon },
] as const;

type ShellUser = {
  name: string | null;
  email: string | null;
  planLabel: string;
  fullAccess: boolean;
};

export function DashboardShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = user.name?.trim() || user.email?.split("@")[0] || "Account";
  const initial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", onPointerDown);
      return () => document.removeEventListener("mousedown", onPointerDown);
    }
  }, [menuOpen]);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-2 pt-2">
      {NAV.map((item) => {
        const active = isActive(item.href, "exact" in item ? item.exact : false);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition ${
              active
                ? "bg-black/[0.06] text-black"
                : "text-black/55 hover:bg-black/[0.04] hover:text-black"
            }`}
          >
            <Icon className="size-4 shrink-0 opacity-80" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const userBlock = (
    <div className="relative border-t border-black/8 p-2" ref={menuRef}>
      {menuOpen ? (
        <div className="absolute bottom-[calc(100%+8px)] left-2 right-2 z-50 overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_12px_40px_rgb(0_0_0_/_0.12)]">
          <div className="border-b border-black/8 px-3.5 py-3">
            <p className="text-sm font-semibold text-black">{displayName}</p>
            {user.email ? (
              <p className="mt-0.5 truncate text-xs text-black/50">{user.email}</p>
            ) : null}
          </div>
          {!user.fullAccess ? (
            <div className="border-b border-black/8 p-2">
              <Link
                href="/dashboard/billing"
                className="flex w-full items-center justify-center rounded-lg bg-black px-3 py-2 text-[13px] font-semibold text-white hover:bg-black/85"
                onClick={() => setMenuOpen(false)}
              >
                Upgrade plan
              </Link>
            </div>
          ) : null}
          <div className="p-1.5">
            <Link
              href="/download"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-black/70 hover:bg-black/[0.04] hover:text-black"
              onClick={() => setMenuOpen(false)}
            >
              <DownloadIcon className="size-4" />
              Download Windows app
            </Link>
            <Link
              href="/#faq"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-black/70 hover:bg-black/[0.04] hover:text-black"
              onClick={() => setMenuOpen(false)}
            >
              <HelpIcon className="size-4" />
              Help
            </Link>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-black/70 hover:bg-black/[0.04] hover:text-black"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogoutIcon className="size-4" />
              Log out
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-black/[0.04]"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-black text-[12px] font-semibold text-white">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-black">
            {displayName}
          </span>
          <span className="block truncate text-[11px] text-black/45">{user.planLabel}</span>
        </span>
        <MoreIcon className="size-4 shrink-0 text-black/35" />
      </button>
    </div>
  );

  return (
    <div className="dashboard-light flex min-h-screen bg-[var(--dash-bg)] text-[var(--dash-fg)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-black/8 bg-[var(--dash-sidebar)] lg:flex">
        <div className="flex h-14 items-center px-4">
          <Link href="/dashboard" className="dash-brand">
            <BrandMark />
          </Link>
        </div>
        {nav}
        {userBlock}
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-black/8 bg-[var(--dash-sidebar)] px-4 lg:hidden">
        <Link href="/dashboard" className="dash-brand">
          <BrandMark />
        </Link>
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
          <aside className="absolute left-0 top-14 flex h-[calc(100vh-3.5rem)] w-[min(280px,88vw)] flex-col border-r border-black/8 bg-[var(--dash-sidebar)] shadow-xl">
            {nav}
            {userBlock}
          </aside>
        </div>
      ) : null}

      <main className="min-w-0 flex-1 pt-14 lg:pt-0">
        <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">{children}</div>
      </main>
    </div>
  );
}
