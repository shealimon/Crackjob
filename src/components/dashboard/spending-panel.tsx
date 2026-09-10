import type { DashboardPayload } from "@/lib/dashboard-data";

export function SpendingPanel({ initial }: { initial: DashboardPayload }) {
  const totalCredits = initial.usageByDay.reduce((sum, d) => sum + d.creditsUsed, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
          Spending
        </h1>
        <p className="mt-2 text-sm text-black/50">
          Plan spend and AI usage for this account.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-black/8 bg-white p-5 sm:p-6">
          <p className="text-xs text-black/45">Subscription</p>
          <p className="mt-2 text-2xl font-semibold text-black">
            {initial.user.fullAccess ? initial.user.planLabel : "₹0"}
          </p>
          <p className="mt-2 text-sm text-black/55">
            {initial.user.fullAccess
              ? initial.user.endsAt
                ? `Active until ${new Date(initial.user.endsAt).toLocaleDateString("en-IN")}`
                : "Active"
              : "Free explore — no subscription charge"}
          </p>
        </div>
        <div className="rounded-2xl border border-black/8 bg-white p-5 sm:p-6">
          <p className="text-xs text-black/45">AI credits (14 days)</p>
          <p className="mt-2 text-2xl font-semibold text-black">
            {totalCredits.toLocaleString("en-IN")}
          </p>
          <p className="mt-2 text-sm text-black/55">
            Token usage for visibility. Not billed separately on free explore.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-black/8 bg-white p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-black">On-demand spend</h2>
        <p className="mt-3 text-sm leading-6 text-black/55">
          Paid checkout and usage-based billing via Razorpay will show here once
          live. Until then, free explore is a one-time limit (not daily).
        </p>
      </section>
    </div>
  );
}
