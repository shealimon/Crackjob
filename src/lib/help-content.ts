import { PRODUCT_NAME } from "@/lib/constants";

export const HELP_SUPPORT_EMAIL = "help@crackjob.co";

export type HelpTopicId =
  | "getting-started"
  | "shortcuts"
  | "basic-checks"
  | "settings"
  | "undetectability"
  | "cant-see-overlay"
  | "visible-on-share"
  | "screen-share-permissions";

export function howItWorksPath(id: HelpTopicId) {
  return `/how-it-works/${id}`;
}

export type HelpNavGroup = {
  title: string;
  items: { id: HelpTopicId; label: string }[];
};

export const HELP_NAV: HelpNavGroup[] = [
  {
    title: "General",
    items: [
      { id: "getting-started", label: "Getting Started" },
      { id: "shortcuts", label: "Shortcuts" },
      { id: "basic-checks", label: "Basic Checks" },
      { id: "settings", label: "Settings" },
      { id: "undetectability", label: "Undetectability" },
    ],
  },
  {
    title: "Troubleshooting",
    items: [
      { id: "cant-see-overlay", label: "No overlay" },
      { id: "visible-on-share", label: "Visible on share" },
      { id: "screen-share-permissions", label: "Screen share" },
    ],
  },
  {
    title: "Support",
    items: [],
  },
];

export const HELP_TOPIC_IDS: HelpTopicId[] = HELP_NAV.flatMap((g) =>
  g.items.map((i) => i.id),
);

export type HelpShortcut = {
  action: string;
  keys: string[];
};

/** Same order as Desktop Application → Settings → Shortcuts */
export const DESKTOP_SHORTCUTS: HelpShortcut[] = [
  { action: "Screenshot (coding screen)", keys: ["Ctrl", "H"] },
  { action: "Get answer", keys: ["Ctrl", "Enter"] },
  { action: "Show / hide UI", keys: ["Ctrl", "B"] },
  { action: "Clear output window", keys: ["Ctrl", "G"] },
  { action: "History", keys: ["Ctrl", "Y"] },
  { action: "Move panel", keys: ["Ctrl", "← ↑ ↓ →"] },
  { action: "Scroll answer", keys: ["Ctrl", "Shift", "↑↓"] },
];

export type HelpLink = { href: string; label: string };

export type HelpStep = {
  title: string;
  body?: string;
  links?: HelpLink[];
};

export type HelpUndetectRow = {
  riskTitle: string;
  riskBody: string;
  fixTitle: string;
  fixBody: string;
};

export type HelpSettingRow = {
  label: string;
  description: string;
  examples?: string[];
  links?: HelpLink[];
};

export type HelpTopicContent = {
  id: HelpTopicId;
  title: string;
  subtitle: string;
  cardTitle?: string;
  steps?: HelpStep[];
  paragraphs?: { text: string; links?: HelpLink[] }[];
  settingRows?: HelpSettingRow[];
  undetectRows?: HelpUndetectRow[];
  shortcuts?: HelpShortcut[];
  note?: string;
};

export const HELP_TOPICS: Record<HelpTopicId, HelpTopicContent> = {
  "getting-started": {
    id: "getting-started",
    title: "Getting Started",
    subtitle: "Desktop Application on Windows — same login as the website.",
    steps: [
      {
        title: "Download & install",
        links: [{ href: "/download", label: "Download .msi" }],
      },
      {
        title: "Sign up on website → sign in on desktop",
        links: [
          { href: "/signup", label: "Sign up" },
          { href: "/login", label: "Log in" },
        ],
      },
      {
        title: "Test screen share once",
        links: [{ href: howItWorksPath("basic-checks"), label: "Basic checks" }],
      },
      {
        title: "Gear → languages and resume",
        links: [{ href: howItWorksPath("settings"), label: "Settings" }],
      },
      {
        title: "On call: Start → Ctrl+H → Ctrl+Enter",
        links: [{ href: howItWorksPath("shortcuts"), label: "All shortcuts" }],
      },
    ],
  },
  shortcuts: {
    id: "shortcuts",
    title: "Shortcuts",
    subtitle: "Memorize these three: Start · Ctrl+H · Ctrl+Enter",
    paragraphs: [
      { text: "Coding / OA on screen: Ctrl+H, then Ctrl+Enter." },
      { text: "Interviewer speaking: Start (toolbar), then Ctrl+Enter when ready." },
      { text: "Typed question: type in panel → Ctrl+Enter." },
    ],
    shortcuts: DESKTOP_SHORTCUTS,
  },
  "basic-checks": {
    id: "basic-checks",
    title: "Basic Checks",
    subtitle: "5 minutes before a real interview.",
    steps: [
      { title: "Meet / Zoom / Teams — share full screen" },
      { title: "Other person should NOT see toolbar or answers" },
      { title: "You still see overlay on your PC" },
      { title: "Ctrl+B hide, Ctrl+B show" },
      { title: "Ctrl+H — screenshot" },
      { title: "Ctrl+Enter — answer appears" },
    ],
  },
  settings: {
    id: "settings",
    title: "Settings",
    subtitle: "Toolbar → gear icon.",
    settingRows: [
      {
        label: "Output language",
        description: "Language of the answer text.",
        examples: [
          "English",
          "Hindi",
          "Spanish",
          "French",
          "German",
          "Portuguese",
          "Mandarin",
          "Japanese",
          "Korean",
          "Arabic",
          "Tamil",
          "Bengali",
          "Urdu",
        ],
      },
      {
        label: "Code language",
        description: "Language used for generated code.",
        examples: [
          "Python",
          "JavaScript",
          "TypeScript",
          "Java",
          "C",
          "C++",
          "C#",
          "Go",
          "Rust",
          "Kotlin",
          "Swift",
          "SQL",
          "PHP",
          "Ruby",
        ],
      },
      {
        label: "Meeting audio language",
        description: "Language for voice transcription.",
        examples: [
          "English",
          "Hindi",
          "Spanish",
          "French",
          "German",
          "Japanese",
          "Portuguese",
          "Russian",
          "Mandarin",
          "Cantonese",
          "Italian",
          "Auto-detect",
        ],
      },
      {
        label: "Resume / CV",
        description: "Upload from Profile in the Dashboard menu (web) or on desktop.",
        links: [{ href: "/dashboard/settings", label: "Open Profile" }],
      },
    ],
  },
  undetectability: {
    id: "undetectability",
    title: "Undetectability",
    subtitle: "Hidden from their screen share — visible to you.",
    undetectRows: [
      {
        riskTitle: "Screen share",
        riskBody: "They see your IDE.",
        fixTitle: "Overlay excluded from capture",
        fixBody: "Meet / Teams / Zoom skip the overlay on their view.",
      },
      {
        riskTitle: "Browser tests",
        riskBody: "Sites scan extensions.",
        fixTitle: "Desktop program",
        fixBody: "Not a browser extension.",
      },
      {
        riskTitle: "Someone at your desk",
        riskBody: "Need to hide fast.",
        fixTitle: "Ctrl+B",
        fixBody: "Hide/show without killing the session.",
      },
      {
        riskTitle: "Eyes on camera",
        riskBody: "Panel far from code.",
        fixTitle: "Ctrl + arrows",
        fixBody: "Move answers next to your editor.",
      },
    ],
  },
  "cant-see-overlay": {
    id: "cant-see-overlay",
    title: "No Overlay",
    subtitle: "",
    steps: [
      { title: "Ctrl+B — maybe hidden" },
      { title: "Sign in on desktop if you see login only" },
      { title: "Ctrl + arrows — moved off screen" },
      {
        title: "Quit from gear → reopen",
        links: [{ href: "/download", label: "Reinstall" }],
      },
    ],
  },
  "visible-on-share": {
    id: "visible-on-share",
    title: "Visible on Share",
    subtitle: "",
    steps: [
      { title: "Share entire screen (same as real interview)" },
      {
        title: "Re-test with phone / friend",
        links: [{ href: howItWorksPath("basic-checks"), label: "Basic checks" }],
      },
      {
        title: "Update installer",
        links: [{ href: "/download", label: "Download" }],
      },
    ],
    note: `Still wrong? ${HELP_SUPPORT_EMAIL}`,
  },
  "screen-share-permissions": {
    id: "screen-share-permissions",
    title: "Screen Share",
    subtitle: "Share full screen on same monitor as your code.",
    steps: [
      { title: "Meet — Share → Entire screen" },
      { title: "Zoom — Screen / Desktop" },
      { title: "Teams — Share → Screen" },
      {
        title: "After OS or monitor change — re-run checks",
        links: [{ href: howItWorksPath("basic-checks"), label: "Basic checks" }],
      },
    ],
  },
};

export function getHelpTopic(id: string): HelpTopicContent | null {
  if (id in HELP_TOPICS) {
    return HELP_TOPICS[id as HelpTopicId];
  }
  return null;
}

export function helpTopicMetadata(id: HelpTopicId) {
  const topic = HELP_TOPICS[id];
  return {
    title: `${topic.title} | How it works | ${PRODUCT_NAME}`,
    description: topic.subtitle || topic.title,
  };
}
