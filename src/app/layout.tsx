import type { Metadata } from "next";
import { Doto, Geist_Mono, Instrument_Serif, Outfit, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/providers";
import { PRODUCT_NAME } from "@/lib/constants";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const doto = Doto({
  variable: "--font-doto",
  subsets: ["latin"],
  axes: ["ROND"],
});

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} — Undetectable AI for Interviews`,
  description:
    "The undetectable desktop overlay for technical interviews. Hidden from screen share, dock, and recordings. DSA, system design, LLD, OA, and more.",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${geistMono.variable} ${instrument.variable} ${outfit.variable} ${doto.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
