import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalShell } from "@/components/legal/legal-shell";
import {
  getLegalPage,
  LEGAL_PAGE_IDS,
  legalPageMetadata,
  legalPath,
  type LegalPageId,
} from "@/lib/legal-content";
import { PRODUCT_NAME } from "@/lib/constants";
import { absoluteUrl } from "@/lib/seo";

type PageProps = {
  params: Promise<{ page: string }>;
};

export function generateStaticParams() {
  return LEGAL_PAGE_IDS.map((page) => ({ page }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page: slug } = await params;
  const id = slug as LegalPageId;
  const content = getLegalPage(id);
  if (!content) {
    return { title: `Legal | ${PRODUCT_NAME}` };
  }
  const { title, description } = legalPageMetadata(id);
  const url = absoluteUrl(legalPath(id));
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "article" },
  };
}

export default async function LegalPageRoute({ params }: PageProps) {
  const { page: slug } = await params;
  const page = getLegalPage(slug);
  if (!page) notFound();
  return <LegalShell page={page} />;
}
