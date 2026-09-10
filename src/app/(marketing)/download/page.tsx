import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/lib/constants";

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
      <h1 className="mt-3 font-serif text-5xl">Transparent overlay app.</h1>
      <p className="mt-4 text-muted leading-7">
        Crack lives in <code className="text-accent">desktop/</code>{" "}
        as a Tauri 2 + React overlay. It stays out of screen share, captures a
        screenshot on Ctrl+Shift+S, and shows the answer on a light transparent panel.
      </p>
      <ol className="mt-10 space-y-4 text-sm leading-7 text-muted">
        <li>1. Install Rust (rustup) and Microsoft WebView2 if needed.</li>
        <li>
          2. Run the website on{" "}
          <code className="text-foreground">http://localhost:43123</code>.
        </li>
        <li>
          3. In <code className="text-foreground">desktop/</code>, run{" "}
          <code className="text-foreground">npm install</code> then{" "}
          <code className="text-foreground">npm run tauri dev</code>.
        </li>
        <li>
          4. Google login on the website, open{" "}
          <code className="text-foreground">/auth/desktop</code>, paste the
          one-time code in the app.
        </li>
      </ol>
      <p className="mt-8 text-sm text-muted">
        Signed installer downloads will land here once the Tauri build is signed.
      </p>
    </main>
  );
}
