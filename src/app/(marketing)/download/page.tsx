import type { Metadata } from "next";
import { AppDownloadLink } from "@/components/app-download-link";
import { WindowsIcon } from "@/components/landing/icons";
import {
  DESKTOP_APPLICATION_LABEL,
  PRODUCT_NAME,
  WINDOWS_APP_DOWNLOAD_FILENAME,
} from "@/lib/constants";
import { absoluteUrl, SEO_SHARE_IMAGE } from "@/lib/seo";

const DOWNLOAD_TITLE = `Download ${PRODUCT_NAME} for Windows`;
const DOWNLOAD_DESCRIPTION = `Download the ${DESKTOP_APPLICATION_LABEL} — an AI interview assistant for live interviews, including coding, DSA, SQL, and system design.`;

export const metadata: Metadata = {
  title: DOWNLOAD_TITLE,
  description: DOWNLOAD_DESCRIPTION,
  alternates: { canonical: absoluteUrl("/download") },
  openGraph: {
    type: "website",
    title: DOWNLOAD_TITLE,
    description: DOWNLOAD_DESCRIPTION,
    url: absoluteUrl("/download"),
    images: [SEO_SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: DOWNLOAD_TITLE,
    description: DOWNLOAD_DESCRIPTION,
    images: ["/twitter-image"],
  },
};

export default function DownloadPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-16 pt-28">
      <p className="text-xs uppercase tracking-[0.2em] text-accent">Windows first</p>
      <h1 className="mt-3 font-serif text-5xl">Download for Windows</h1>
      <p className="mt-4 text-muted leading-7">
        Install the {DESKTOP_APPLICATION_LABEL} for live interviews. This is the Windows program
        you run on your PC — separate from the {PRODUCT_NAME} website. It stays invisible on
        Zoom, Google Meet, and Teams screen share.
      </p>

      <AppDownloadLink className="btn-meet mt-10 inline-flex h-14 items-center gap-2 rounded-full px-8 text-[16px] font-semibold transition hover:scale-[1.02] active:scale-[0.98]">
        <WindowsIcon className="size-4" />
        Download {WINDOWS_APP_DOWNLOAD_FILENAME}
      </AppDownloadLink>

      <ol className="mt-10 space-y-4 text-sm leading-7 text-muted">
        <li>1. Download and run the Windows installer (.msi).</li>
        <li>2. Open the Desktop Application and sign in with the same email and password you use on the website.</li>
        <li>3. Use the overlay during interviews — answers stay off screen share.</li>
      </ol>
    </main>
  );
}
