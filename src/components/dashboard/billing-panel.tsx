import Link from "next/link";
import { PLAN_PACKS } from "@/lib/constants";
import type { DashboardPayload } from "@/lib/dashboard-data";

export function BillingPanel({ initial }: { initial: DashboardPayload }) {
  const { user } = initial;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
          Billing & Invoices
        </h1>
        <p className="mt-2 text-sm text-black/50">
          Manage your plan. Invoices appear after Razorpay checkout goes live.
        </p>
      </div>

      <section className="rounded-2xl border border-black/8 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-black/45">Current plan</p>
            <p className="mt-1 text-xl font-semibold text-black">{user.planLabel}</p>
            <p className="mt-2 text-sm text-black/55">
              {user.fullAccess
                ? user.endsAt
                  ? `Renews / ends ${new Date(user.endsAt).toLocaleDateString("en-IN")}`
                  : "Full access"
                : `Free explore — ${user.exploreRemaining ?? 0} solves left today`}
            </p>
          </div>
          {!user.fullAccess ? (
            <span className="rounded-lg bg-black px-3.5 py-2 text-[13px] font-semibold text-white opacity-60">
              Checkout coming soon
            </span>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {PLAN_PACKS.map((pack) => {
          const current = user.plan === pack.id;
          return (
            <div
              key={pack.id}
              className="rounded-2xl border border-black/8 bg-white p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-black">{pack.name}</h3>
                {current ? (
                  <span className="rounded-full bg-black/6 px-2 py-0.5 text-[11px] font-medium text-black/60">
                    Current
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-xl font-semibold text-black">{pack.priceLabel}</p>
              <p className="mt-2 text-sm text-black/55">{pack.note}</p>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-black/8 bg-white p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-black">Invoices</h2>
        <p className="mt-3 text-sm leading-6 text-black/55">
          No invoices yet. After payment is enabled, receipts for 1 month / 3
          months / yearly will list here.
        </p>
        <Link
          href="/#pricing"
          className="mt-4 inline-flex text-[13px] font-semibold text-black underline-offset-4 hover:underline"
        >
          View public pricing
        </Link>
      </section>
    </div>
  );
}
