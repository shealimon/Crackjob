import type { Metadata } from "next";
import { AppDownloadLink } from "@/components/app-download-link";
import { WindowsIcon } from "@/components/landing/icons";
import {
  PRODUCT_NAME,
  WINDOWS_APP_DOWNLOAD_FILENAME,
} from "@/lib/constants";

export const metadata: Metadata = {
  title: `Download ${PRODUCT_NAME} for Windows`,
  description: `Download the ${PRODUCT_NAME} Windows app — undetectable AI interview assistant for Zoom, Google Meet, and Teams. Real-time coding interview help hidden from screen share.`,
  alternates: { canonical: "/download" },
  openGraph: {
    title: `Download ${PRODUCT_NAME} — AI Interview App for Windows`,
    description: `Install ${PRODUCT_NAME} for live technical interviews. Invisible overlay with ChatGPT-style answers for DSA, system design, and more.`,
    url: "/download",
  },
};

export default function DownloadPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-16 pt-28">
      <p className="text-xs uppercase tracking-[0.2em] text-accent">Windows first</p>
      <h1 className="mt-3 font-serif text-5xl">Download for Windows</h1>
      <p className="mt-4 text-muted leading-7">
        Install the {PRODUCT_NAME} overlay for live interviews. It stays invisible on Zoom,
        Google Meet, and Teams screen share.
      </p>

      <AppDownloadLink className="btn-meet mt-10 inline-flex h-14 items-center gap-2 rounded-full px-8 text-[16px] font-semibold transition hover:scale-[1.02] active:scale-[0.98]">
        <WindowsIcon className="size-4" />
        Download {WINDOWS_APP_DOWNLOAD_FILENAME}
      </AppDownloadLink>

      <ol className="mt-10 space-y-4 text-sm leading-7 text-muted">
        <li>1. Download and run the Windows installer (.msi).</li>
        <li>2. Open the app and sign in with the same Google account you use on the website.</li>
        <li>3. Use the overlay during interviews — answers stay off screen share.</li>
      </ol>
    </main>
  );
}
