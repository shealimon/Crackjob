export const INTERVIEW_MODES = [
  { id: "dsa", label: "DSA / Coding", hint: "Clarify → brute force → optimized + explain-as-you-code" },
  { id: "lld", label: "LLD / Machine Coding", hint: "Classes, APIs, core methods" },
  { id: "system_design", label: "System Design", hint: "HLD bullets, capacity, trade-offs" },
  { id: "fundamentals", label: "Technical Fundamentals", hint: "OS, DBMS, CN, OOPs" },
  { id: "oa", label: "Online Assessment (OA)", hint: "Clarify I/O → brute force → optimized + edges" },
  { id: "service", label: "Service-Based", hint: "TCS, Infosys, Wipro patterns" },
  { id: "project", label: "Project Round", hint: "Architecture, your role, follow-ups" },
] as const;

export type InterviewModeId = (typeof INTERVIEW_MODES)[number]["id"];

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

export const COMPANY_PACKS = ["", ...PRODUCT_COMPANIES, ...SERVICE_COMPANIES];

export const LOW_CREDITS_WARNING = 2000;

/** Dev → localhost; release build → live site (override with VITE_API_URL).
 * Use apex crackjob.co — www 308-redirects and WebView POST login fails ("Failed to fetch"). */
export const DEFAULT_API_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:43123" : "https://crackjob.co")
).replace(/\/$/, "");

export const OUTPUT_LANGUAGES = [
  "Arabic (العربية)",
  "Bengali (বাংলা)",
  "Cantonese (粵語)",
  "German (Deutsch)",
  "English",
  "Farsi (فارسی)",
  "French (Français)",
  "Hindi (हिन्दी)",
  "Italian (Italiano)",
  "Japanese (日本語)",
  "Korean (한국어)",
  "Mandarin (普通话)",
  "Dutch (Nederlands)",
  "Polish (Polski)",
  "Portuguese (Português)",
  "Russian (Русский)",
  "Spanish (Español)",
  "Tamil (தமிழ்)",
  "Thai (ไทย)",
  "Turkish (Türkçe)",
  "Urdu (اردو)",
  "Vietnamese (Tiếng Việt)",
] as const;

/** Legacy labels → current Output Language options (prefs migration). */
export const OUTPUT_LANGUAGE_ALIASES: Record<string, (typeof OUTPUT_LANGUAGES)[number]> = {
  Arabic: "Arabic (العربية)",
  Bengali: "Bengali (বাংলা)",
  Cantonese: "Cantonese (粵語)",
  German: "German (Deutsch)",
  Farsi: "Farsi (فارسی)",
  Persian: "Farsi (فارسی)",
  French: "French (Français)",
  Hindi: "Hindi (हिन्दी)",
  Italian: "Italian (Italiano)",
  Japanese: "Japanese (日本語)",
  Korean: "Korean (한국어)",
  Mandarin: "Mandarin (普通话)",
  "Chinese (Mandarin)": "Mandarin (普通话)",
  Chinese: "Mandarin (普通话)",
  Dutch: "Dutch (Nederlands)",
  Polish: "Polish (Polski)",
  Portuguese: "Portuguese (Português)",
  Russian: "Russian (Русский)",
  Spanish: "Spanish (Español)",
  Tamil: "Tamil (தமிழ்)",
  Thai: "Thai (ไทย)",
  Turkish: "Turkish (Türkçe)",
  Urdu: "Urdu (اردو)",
  Vietnamese: "Vietnamese (Tiếng Việt)",
};

export const POPULAR_OUTPUT_LANGUAGES = [
  "English",
  "Hindi (हिन्दी)",
  "Spanish (Español)",
  "French (Français)",
  "German (Deutsch)",
  "Portuguese (Português)",
  "Mandarin (普通话)",
  "Japanese (日本語)",
  "Korean (한국어)",
  "Arabic (العربية)",
] as const;

/** Flat order matching settings Code Language reference UI. */
export const CODE_LANGUAGES = [
  "Python",
  "JavaScript",
  "TypeScript",
  "Java",
  "PHP",
  "Golang",
  "R",
  "Ruby",
  "C",
  "C++",
  "C#",
  "Rust",
  "Kotlin",
  "Swift",
  "Dart",
  "SQL",
] as const;

/** Legacy labels → current Code Language options (prefs migration). */
export const CODE_LANGUAGE_ALIASES: Record<string, (typeof CODE_LANGUAGES)[number]> = {
  Go: "Golang",
  go: "Golang",
};

export const MEETING_AUDIO_LANGUAGES = [
  "Chinese (Cantonese) (繁體中文)",
  "Chinese (Mandarin) (简体中文)",
  "English (recommended)",
  "French (Français)",
  "German (Deutsch)",
  "Hindi (हिन्दी)",
  "Italian (Italiano)",
  "Japanese (日本語)",
  "Portuguese (Português)",
  "Russian (Русский)",
  "Spanish (Español)",
  "Auto-detect language",
] as const;

/** Legacy labels → current Meeting Audio Language options (prefs migration). */
export const MEETING_AUDIO_LANGUAGE_ALIASES: Record<string, (typeof MEETING_AUDIO_LANGUAGES)[number]> = {
  English: "English (recommended)",
  "English US": "English (recommended)",
  "English UK": "English (recommended)",
  "Mandarin (普通话)": "Chinese (Mandarin) (简体中文)",
  "Chinese (Mandarin)": "Chinese (Mandarin) (简体中文)",
  Chinese: "Chinese (Mandarin) (简体中文)",
  "Cantonese (粵語)": "Chinese (Cantonese) (繁體中文)",
  Cantonese: "Chinese (Cantonese) (繁體中文)",
  French: "French (Français)",
  German: "German (Deutsch)",
  Hindi: "Hindi (हिन्दी)",
  Italian: "Italian (Italiano)",
  Japanese: "Japanese (日本語)",
  Portuguese: "Portuguese (Português)",
  Russian: "Russian (Русский)",
  Spanish: "Spanish (Español)",
  Auto: "Auto-detect language",
  "Auto-detect": "Auto-detect language",
};

export const SELECT_SEPARATOR = "__separator__" as const;
export type SelectMenuItem = string | typeof SELECT_SEPARATOR;

/** Flat list matching reference order (no popular/separator grouping). */
export const OUTPUT_LANGUAGE_OPTIONS: SelectMenuItem[] = [...OUTPUT_LANGUAGES];
export const CODE_LANGUAGE_OPTIONS: SelectMenuItem[] = [...CODE_LANGUAGES];
export const MEETING_AUDIO_LANGUAGE_OPTIONS: SelectMenuItem[] = [...MEETING_AUDIO_LANGUAGES];

export const DEMO_USER = {
  id: "local",
  name: "Candidate",
  email: null,
  creditBalance: 50_000,
} as const;

/** Must match website `FREE_*` — free explore is a one-time lifetime quota. */
export const FREE_FULL_SOLVES = 10;
export const FREE_PARTIAL_SOLVES = 5;
export const FREE_EXPLORE_SOLVES = FREE_FULL_SOLVES + FREE_PARTIAL_SOLVES;
/** @deprecated Use FREE_EXPLORE_SOLVES — quota is lifetime, not daily. */
export const FREE_DAILY_SOLVES = FREE_EXPLORE_SOLVES;

export const FREE_PARTIAL_UPGRADE_MSG =
  "Preview only — upgrade for the full answer and unlimited solves.";

export const FREE_LIMIT_UPGRADE_MSG =
  "Free explore limit reached.\nUpgrade for Unlimited Access.";
