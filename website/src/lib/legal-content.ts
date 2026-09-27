import { PLAN_PACKS, PRODUCT_NAME, WINDOWS_APP_DOWNLOAD_URL } from "@/lib/constants";
import { HELP_SUPPORT_EMAIL } from "@/lib/help-content";
import { SITE_URL } from "@/lib/seo";

/** Operating entity details — update registered address / GSTIN when incorporated. */
export const LEGAL_ENTITY_NAME = PRODUCT_NAME;
export const LEGAL_BRAND = `${PRODUCT_NAME}™`;
export const LEGAL_WEBSITE = SITE_URL;
export const LEGAL_SUPPORT_EMAIL = HELP_SUPPORT_EMAIL;
export const LEGAL_PRIVACY_EMAIL = "privacy@crackjob.co";
export const LEGAL_GRIEVANCE_EMAIL = HELP_SUPPORT_EMAIL;

export const LEGAL_REGISTERED_OFFICE =
  "Bengaluru, Karnataka, India (complete registered address shared on invoice or on request)";

export const LEGAL_LAST_UPDATED = "27 September 2026";

export type LegalPageId = "terms" | "privacy" | "refunds" | "delivery";

export function legalPath(id: LegalPageId): string {
  return `/${id}`;
}

export const LEGAL_PAGE_IDS: LegalPageId[] = ["terms", "privacy", "refunds", "delivery"];

export const LEGAL_NAV: { id: LegalPageId; label: string }[] = [
  { id: "terms", label: "Terms & Conditions" },
  { id: "privacy", label: "Privacy Policy" },
  { id: "refunds", label: "Refunds & Cancellation" },
  { id: "delivery", label: "Delivery Policy" },
];

export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalPageContent = {
  id: LegalPageId;
  title: string;
  subtitle?: string;
  sections: LegalSection[];
};

const planSummary = PLAN_PACKS.map((p) => `${p.name} — ${p.priceLabel} (+ GST as applicable)`).join(
  "; ",
);

const pages: Record<LegalPageId, LegalPageContent> = {
  terms: {
    id: "terms",
    title: "Terms & Conditions",
    subtitle: `These terms govern your use of ${LEGAL_ENTITY_NAME} on ${LEGAL_WEBSITE.replace("https://", "")}. By creating an account, paying for a plan, or using the desktop app, you agree to them.`,
    sections: [
      {
        heading: "1. Who we are",
        paragraphs: [
          `${LEGAL_BRAND} is operated by ${LEGAL_ENTITY_NAME} (“we”, “us”, “our”), an Indian business offering a software subscription and desktop application for interview preparation assistance.`,
          `Our website is ${LEGAL_WEBSITE}. Support: ${LEGAL_SUPPORT_EMAIL}. Registered office: ${LEGAL_REGISTERED_OFFICE}.`,
        ],
      },
      {
        heading: "2. Eligibility",
        bullets: [
          "You must be at least 18 years old, or the age of majority in your state/union territory, whichever is higher.",
          "You must provide accurate account information and keep your login credentials secure.",
          "You are responsible for all activity under your account.",
        ],
      },
      {
        heading: "3. Service description",
        paragraphs: [
          `${PRODUCT_NAME} provides real-time AI-assisted answers, transcription, and related tools through our website and Windows desktop application. Features depend on your plan and product version.`,
          "We may update, add, or remove features. We will try to give reasonable notice for material changes that affect paid access.",
        ],
      },
      {
        heading: "4. Acceptable use & interview integrity",
        paragraphs: [
          "You must follow the rules of every interview, employer, university, exam portal, and platform you use. If an organization prohibits outside assistance, you must not use Crackjob for that session.",
          "You agree not to misuse the service for fraud, harassment, illegal activity, or to violate third-party terms (Zoom, Google Meet, Microsoft Teams, HackerRank, LeetCode, etc.).",
          "We may suspend or terminate accounts that abuse the service, attempt to reverse-engineer it, resell access, or create risk for other users.",
        ],
      },
      {
        heading: "5. Plans, pricing & payments (India)",
        paragraphs: [
          `Paid plans are sold in Indian Rupees (INR) through Razorpay or other payment partners we enable. Current packs: ${planSummary}.`,
          "Prices on the website are exclusive of GST unless stated otherwise. Applicable GST is charged at checkout as per Indian law.",
          "Access starts when payment is confirmed. Renewals extend from your existing end date if you still have active time, otherwise from the purchase date.",
          "Failed or disputed payments may pause access until resolved.",
        ],
      },
      {
        heading: "6. Free explore tier",
        paragraphs: [
          "New accounts may receive a limited free explore allowance (full and preview solves) as shown in the app. Free allowances are promotional, may change, and are not transferable.",
        ],
      },
      {
        heading: "7. Intellectual property",
        paragraphs: [
          `${PRODUCT_NAME}, its branding, software, and website content are owned by us or our licensors. You receive a limited, non-exclusive, non-transferable licence to use the service for personal interview preparation while your plan is active.`,
          "You retain ownership of content you upload (for example résumé text). You grant us a licence to process that content solely to provide the service.",
        ],
      },
      {
        heading: "8. AI outputs & disclaimers",
        paragraphs: [
          "Answers are generated by AI and may be incorrect, incomplete, or outdated. You are solely responsible for what you say in an interview or submit in an assessment.",
          "The service is provided on an “as is” and “as available” basis. We do not guarantee job offers, interview outcomes, or undetectability in every environment.",
        ],
      },
      {
        heading: "9. Limitation of liability",
        paragraphs: [
          "To the maximum extent permitted under the Consumer Protection Act, 2019 and other applicable Indian law, we are not liable for indirect, incidental, or consequential damages, loss of earnings, or reputational harm arising from use of the service.",
          "Our aggregate liability for any claim relating to the service is limited to the amount you paid us for the plan in the three (3) months before the event giving rise to the claim.",
        ],
      },
      {
        heading: "10. Termination",
        paragraphs: [
          "You may stop using the service anytime. We may suspend or terminate access for breach of these terms, legal requirement, or prolonged inactivity on free accounts.",
          "Sections that by nature should survive (payment obligations, disclaimers, liability limits, governing law) will survive termination.",
        ],
      },
      {
        heading: "11. Governing law & disputes",
        paragraphs: [
          "These terms are governed by the laws of India. Courts at Bengaluru, Karnataka shall have exclusive jurisdiction, subject to your rights under applicable consumer protection laws in your state.",
          `You may also email ${LEGAL_SUPPORT_EMAIL} (Grievance Officer) before approaching courts.`,
        ],
      },
      {
        heading: "12. Changes",
        paragraphs: [
          `We may update these terms. The “Last updated” date at the top of this page will change. Continued use after updates means you accept the revised terms. Material changes affecting paid users will be communicated by email or in-app notice where practical.`,
        ],
      },
    ],
  },
  privacy: {
    id: "privacy",
    title: "Privacy Policy",
    subtitle: `How ${LEGAL_ENTITY_NAME} collects, uses, and protects personal data in India, including under the Digital Personal Data Protection Act, 2023 (DPDP Act) where applicable.`,
    sections: [
      {
        heading: "1. Data controller",
        paragraphs: [
          `${LEGAL_ENTITY_NAME} (${LEGAL_WEBSITE}) is the data fiduciary for personal data processed through our website and desktop app.`,
          `Privacy questions: ${LEGAL_PRIVACY_EMAIL}. General support: ${LEGAL_SUPPORT_EMAIL}.`,
        ],
      },
      {
        heading: "2. What we collect",
        bullets: [
          "Account data: name, email, authentication identifiers (for example Google sign-in subject to your provider), and profile settings.",
          "Billing data: plan, payment status, Razorpay order/receipt references — card/UPI details are handled by Razorpay, not stored on our servers.",
          "Usage data: session timestamps, feature usage, token/credit consumption, and error logs needed to run the product.",
          "Content you provide: résumé uploads, instructions, screenshots you submit for analysis, and chat prompts — processed to generate answers.",
          "Technical data: device/OS version, app version, IP address, and coarse location derived from IP for fraud prevention and compliance.",
        ],
      },
      {
        heading: "3. Why we use data",
        bullets: [
          "Provide, secure, and improve the interview assistant and website.",
          "Process payments, invoices, and GST-compliant records.",
          "Send service emails (verification, receipts, security alerts). Marketing emails only with consent where required.",
          "Detect abuse, debug failures, and comply with law.",
        ],
      },
      {
        heading: "4. AI & third-party processors",
        paragraphs: [
          "We use subprocessors such as cloud hosting, authentication, payment (Razorpay), email, analytics, and AI model providers to deliver answers and transcription. They process data only under contract and for our instructions.",
          "Do not submit passwords, Aadhaar, PAN, or other sensitive identifiers in prompts or uploads unless strictly necessary — we do not ask for them.",
        ],
      },
      {
        heading: "5. Cookies & similar tech",
        paragraphs: [
          "Our website uses cookies and local storage for login sessions, preferences, and analytics. You can control cookies through your browser; disabling them may break sign-in.",
        ],
      },
      {
        heading: "6. Retention",
        paragraphs: [
          "We keep account and billing records as long as your account is active and for periods required by Indian tax and commercial law (typically up to eight years for financial records).",
          "Interview content may be deleted or anonymized sooner based on product settings; you can request deletion subject to legal holds.",
        ],
      },
      {
        heading: "7. Your rights (India)",
        bullets: [
          "Request access, correction, or erasure of personal data we control, subject to legal exceptions.",
          "Withdraw consent where processing is consent-based (for example optional marketing).",
          "Nominate a contact person where permitted under the DPDP Act.",
          `Lodge a complaint with our Grievance Officer at ${LEGAL_GRIEVANCE_EMAIL} before escalating to the Data Protection Board of India when the framework applies.`,
        ],
      },
      {
        heading: "8. Security",
        paragraphs: [
          `We use encryption in transit (HTTPS), access controls, and vendor security reviews. No method is 100% secure — report suspected breaches to ${LEGAL_PRIVACY_EMAIL} immediately.`,
        ],
      },
      {
        heading: "9. Children",
        paragraphs: [
          "The service is not directed at users under 18. If you believe a minor has provided data, contact us and we will delete it.",
        ],
      },
      {
        heading: "10. International transfers",
        paragraphs: [
          "Some subprocessors may process data outside India. We use contractual safeguards consistent with applicable Indian requirements.",
        ],
      },
      {
        heading: "11. Updates",
        paragraphs: [
          "We will post changes on this page with an updated date. Significant changes will be highlighted on the website or by email where appropriate.",
        ],
      },
    ],
  },
  refunds: {
    id: "refunds",
    title: "Refunds & Cancellation",
    subtitle: "Fair refund rules for digital plans purchased on Crackjob in INR via Razorpay.",
    sections: [
      {
        heading: "1. Nature of product",
        paragraphs: [
          `${PRODUCT_NAME} sells digital access (subscription time on your account) and a downloadable Windows application. There is no physical shipping.`,
          "Once access is activated, value is delivered immediately — refunds are limited as below, in line with the Consumer Protection (E-Commerce) Rules, 2020 for digital content.",
        ],
      },
      {
        heading: "2. When you can request a refund",
        bullets: [
          "Duplicate charge or payment failed but amount debited — contact us within 7 days with Razorpay payment ID.",
          "Technical fault on our side that prevented any meaningful use within 48 hours of purchase — we may offer a full refund or extension after verification.",
          "Wrong plan purchased once — contact within 24 hours before substantial usage; we may switch plans or refund at our discretion.",
        ],
      },
      {
        heading: "3. When refunds are not available",
        bullets: [
          "Change of mind after you have used paid solves, transcription, or AI features beyond the free explore tier.",
          "Partial use of a subscription period (for example 10 days used on a 30-day plan).",
          "Account termination for terms violation or abuse.",
          "Issues caused by your device, network, interview platform policy, or third-party software outside our control.",
        ],
      },
      {
        heading: "4. Cancellations",
        paragraphs: [
          "Paid plans are not auto-renewing subscriptions unless we explicitly enable auto-debit in the future. Today you buy a fixed duration (1 month, 3 months, or yearly); access ends on the shown end date unless you purchase again.",
          "There is nothing to “cancel” mid-term for a refund except under the cases above. You may simply stop using the app.",
        ],
      },
      {
        heading: "5. How to request a refund",
        paragraphs: [
          `Email ${LEGAL_SUPPORT_EMAIL} from your registered account email with:`,
        ],
        bullets: [
          "Full name and registered email",
          "Razorpay payment ID / order ID and date",
          "Reason for request and screenshots if technical",
        ],
      },
      {
        heading: "6. Refund processing",
        paragraphs: [
          "Approved refunds are initiated to the original payment method via Razorpay. Banks and UPI networks typically credit within 5–7 business days; some methods may take longer.",
          "GST invoices, if issued, will be adjusted per applicable law.",
        ],
      },
      {
        heading: "7. Chargebacks",
        paragraphs: [
          "Please contact us before raising a chargeback. Unfounded chargebacks may lead to account closure.",
        ],
      },
    ],
  },
  delivery: {
    id: "delivery",
    title: "Delivery Policy",
    subtitle: "How digital access and the Windows app are delivered to customers in India.",
    sections: [
      {
        heading: "1. What we deliver",
        bullets: [
          "Online account on crackjob.co with dashboard, billing, and settings.",
          `${PRODUCT_NAME} Desktop Application for Windows (download from ${WINDOWS_APP_DOWNLOAD_URL} or links in your account).`,
          "Plan entitlements (access duration and features) applied to your account after successful payment.",
        ],
      },
      {
        heading: "2. Delivery timeline",
        paragraphs: [
          "Account creation: immediate after sign-up and email verification (if required).",
          "Paid plan: access is unlocked within minutes of successful Razorpay payment confirmation — usually instant.",
          "Desktop app: download anytime; installation is on your device. Updates may be delivered in-app or via a new installer on our website.",
        ],
      },
      {
        heading: "3. No physical goods",
        paragraphs: [
          "We do not ship physical products. Invoices and receipts are electronic and available in your dashboard or email.",
        ],
      },
      {
        heading: "4. System requirements",
        bullets: [
          "Windows 10 or 11 (64-bit) with internet access.",
          "Microphone permission if you use live audio features.",
          "Screen-capture permissions as prompted for screenshot-based solves.",
        ],
      },
      {
        heading: "5. Failed delivery",
        paragraphs: [
          `If payment succeeded but access did not unlock within 30 minutes, email ${LEGAL_SUPPORT_EMAIL} with your payment ID. We will fix the account or refund per our Refunds policy.`,
        ],
      },
      {
        heading: "6. Service availability",
        paragraphs: [
          "We target high uptime but maintenance or third-party outages (AI, payment, cloud) may cause brief interruptions. Planned maintenance will be announced when possible.",
        ],
      },
    ],
  },
};

export function getLegalPage(id: string): LegalPageContent | null {
  if (!(id in pages)) return null;
  return pages[id as LegalPageId];
}

export function legalPageMetadata(id: LegalPageId): { title: string; description: string } {
  const page = pages[id];
  return {
    title: page.title,
    description: page.subtitle ?? `${page.title} — ${LEGAL_ENTITY_NAME}`,
  };
}
