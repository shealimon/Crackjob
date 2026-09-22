import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuestionArticle } from "@/components/questions/question-article";
import { PRODUCT_NAME } from "@/lib/constants";
import { getRealQuestion, REAL_QUESTIONS } from "@/lib/real-questions";
import { absoluteUrl, SEO_SHARE_IMAGE } from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return REAL_QUESTIONS.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const question = getRealQuestion(slug);
  if (!question) {
    return { title: `Real Questions | ${PRODUCT_NAME}` };
  }
  const title = question.title;
  const description = question.prompt;
  const url = absoluteUrl(`/questions/${question.slug}`);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      images: [SEO_SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/twitter-image"],
    },
  };
}

export default async function QuestionDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const question = getRealQuestion(slug);
  if (!question) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8 sm:py-10">
      <QuestionArticle question={question} />
    </main>
  );
}
