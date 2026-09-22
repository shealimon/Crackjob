import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HelpShell } from "@/components/help/help-shell";
import {
  getHelpTopic,
  HELP_TOPIC_IDS,
  helpTopicMetadata,
  howItWorksPath,
  type HelpTopicId,
} from "@/lib/help-content";
import { PRODUCT_NAME } from "@/lib/constants";
import { absoluteUrl } from "@/lib/seo";

type PageProps = {
  params: Promise<{ topic: string }>;
};

export function generateStaticParams() {
  return HELP_TOPIC_IDS.map((topic) => ({ topic }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { topic: slug } = await params;
  const id = slug as HelpTopicId;
  const topic = getHelpTopic(id);
  if (!topic) {
    return { title: `How it works | ${PRODUCT_NAME}` };
  }
  const { title, description } = helpTopicMetadata(id);
  const url = absoluteUrl(howItWorksPath(id));
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "article" },
  };
}

export default async function HowItWorksTopicPage({ params }: PageProps) {
  const { topic: slug } = await params;
  const topic = getHelpTopic(slug);
  if (!topic) notFound();
  return <HelpShell topic={topic} />;
}
