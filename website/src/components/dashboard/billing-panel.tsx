"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDashboardData } from "@/components/dashboard/dashboard-data";
import { startPlanCheckout } from "@/components/dashboard/razorpay-checkout";
import { PLAN_PACKS } from "@/lib/constants";
import type { DashboardPayload, DashboardPayment } from "@/lib/dashboard-data";
import { formatInrFromPaise } from "@/lib/razorpay-plans";
import {
  FREE_EXPLORE_SOLVES,
  FREE_FULL_SOLVES,
  FREE_PARTIAL_SOLVES,
  planLabel,
} from "@/lib/plans";

export function BillingPanel({ initial }: { initial: DashboardPayload }) {
  const { user, payments = [] } = initial;
  const { refresh } = useDashboardData();
  const router = useRouter();
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onBuy(planId: string) {
    setBusyPlan(planId);
    setError(null);
    setMessage(null);
    try {
      const result = await startPlanCheckout(planId);
      setMessage(
        result.endsAt
          ? `Payment successful — ${result.planLabel ?? planLabel(planId)} active until ${new Date(result.endsAt).toLocaleDateString("en-IN")}.`
          : "Payment successful. Access unlocked.",
      );
      await refresh();
      router.refresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Checkout failed";
      if (text !== "Payment cancelled") {
        setError(text);
      }
    } finally {
      setBusyPlan(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
          Billing & Invoices
        </h1>
        <p className="mt-2 text-sm text-black/50">
          Buy or renew anytime. Active time extends from your current end date.
        </p>
      </div>

      {message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

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
                : `Free explore — ${user.exploreRemaining ?? 0} of ${FREE_EXPLORE_SOLVES} left (${FREE_FULL_SOLVES} full + ${FREE_PARTIAL_SOLVES} preview · one-time)`}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {PLAN_PACKS.map((pack) => {
          const current = user.plan === pack.id && user.fullAccess;
          const busy = busyPlan === pack.id;
          return (
            <div
              key={pack.id}
              className="flex flex-col rounded-2xl border border-black/8 bg-white p-5"
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
              <button
                type="button"
                disabled={Boolean(busyPlan)}
                onClick={() => void onBuy(pack.id)}
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-black px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Opening checkout…" : current ? "Renew" : "Buy now"}
              </button>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-black/8 bg-white p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-black">Invoices</h2>
        {payments.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-black/55">
            No invoices yet. Receipts appear here after a successful Razorpay
            payment.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-black/8">
            {payments.map((p) => (
              <InvoiceRow key={p.id} payment={p} />
            ))}
          </ul>
        )}
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

function InvoiceRow({ payment }: { payment: DashboardPayment }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
      <div>
        <p className="font-medium text-black">{planLabel(payment.plan)}</p>
        <p className="mt-0.5 text-xs text-black/45">
          {new Date(payment.paidAt ?? payment.createdAt).toLocaleString("en-IN")}
          {payment.razorpayPaymentId
            ? ` · ${payment.razorpayPaymentId}`
            : ""}
        </p>
      </div>
      <div className="text-right">
        <p className="font-semibold text-black">
          {formatInrFromPaise(payment.amountPaise)}
        </p>
        <p className="text-xs capitalize text-black/45">{payment.status}</p>
      </div>
    </li>
  );
}
