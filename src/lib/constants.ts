export const PRODUCT_NAME = "Crackjob";
export const PRODUCT_SHORT = "Crackjob";
export const DEMO_SOLVE_CREDITS = 2_000;
export const DESKTOP_LINK_TTL_MS = 10 * 60 * 1000;

/** Windows MSI served from `website/public/downloads/`. */
export const WINDOWS_APP_DOWNLOAD_FILENAME = "Crackjob-Setup-0.1.0-x64.msi";
export const WINDOWS_APP_DOWNLOAD_URL = `/downloads/${WINDOWS_APP_DOWNLOAD_FILENAME}`;

export const INTERVIEW_MODES = [
  {
    id: "dsa",
    label: "DSA",
    title: "Data structures & algorithms",
    blurb: "LeetCode-style live coding: clarify the problem, brute force, then optimized solution while explaining each step.",
  },
  {
    id: "lld",
    label: "LLD",
    title: "Low-level design",
    blurb: "Classes, APIs, and object design for machine-coding / LLD rounds at product companies.",
  },
  {
    id: "system_design",
    label: "System design",
    title: "High-level system design",
    blurb: "Requirements, capacity, APIs, data model, and trade-offs at India internet scale.",
  },
  {
    id: "fundamentals",
    label: "Fundamentals",
    title: "CS fundamentals",
    blurb: "OS, DBMS, networks, and OOPs — the core grilling in product and service interviews.",
  },
  {
    id: "oa",
    label: "OA",
    title: "Online assessment",
    blurb: "HackerRank / HackerEarth / company OA patterns: constraints, I/O, and passing hidden tests.",
  },
  {
    id: "service",
    label: "Service-based",
    title: "Service-company rounds",
    blurb: "TCS NQT, Infosys, Wipro, Accenture, Cognizant style: aptitude plus coding plus basics.",
  },
  {
    id: "project",
    label: "Project",
    title: "Project deep-dive",
    blurb: "Resume and project walkthroughs: architecture, your role, failures, and follow-up questions.",
  },
] as const;

export type InterviewModeId = (typeof INTERVIEW_MODES)[number]["id"];

export const MODE_IDS = INTERVIEW_MODES.map((mode) => mode.id) as [
  InterviewModeId,
  ...InterviewModeId[],
];

export const PRODUCT_COMPANIES = [
  "Amazon",
  "Google",
  "Microsoft",
  "Flipkart",
  "Swiggy",
  "Zomato",
  "Razorpay",
  "PhonePe",
  "Paytm",
  "CRED",
  "Meesho",
  "Groww",
  "Atlassian",
  "Uber",
  "Salesforce",
];

export const SERVICE_COMPANIES = [
  "TCS",
  "Infosys",
  "Wipro",
  "Accenture",
  "Cognizant",
  "Capgemini",
  "HCLTech",
  "Tech Mahindra",
  "LTIMindtree",
  "Persistent",
];

export const PLAN_PACKS = [
  {
    id: "month_1",
    name: "1 month",
    priceLabel: "₹9,999",
    note: "Full answers for 30 days",
  },
  {
    id: "month_3",
    name: "3 months",
    priceLabel: "₹19,999",
    note: "Full answers for 90 days",
  },
  {
    id: "year",
    name: "Yearly",
    priceLabel: "₹49,999",
    note: "Full answers for 12 months",
    featured: true,
  },
] as const;
