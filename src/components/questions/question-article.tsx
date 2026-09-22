import Link from "next/link";
import { AppDownloadLink } from "@/components/app-download-link";
import { CompanyHighlight } from "@/components/questions/company-highlight";
import { formatQuestionDate, formatQuestionYears, type RealQuestion } from "@/lib/real-questions";

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5.2V8l2 1.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function CommentIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <path
        d="M3 4.4c0-.8.6-1.4 1.4-1.4h7.2c.8 0 1.4.6 1.4 1.4v5.2c0 .8-.6 1.4-1.4 1.4H7.1L4.2 13V11H4.4C3.6 11 3 10.4 3 9.6V4.4Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LikeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <path
        d="M5.2 7.1V13H3.6A1.1 1.1 0 0 1 2.5 11.9V8.2c0-.6.5-1.1 1.1-1.1h1.6Zm0 0 2-3.6c.3-.6 1.1-.8 1.7-.4.4.2.6.7.5 1.1L9 6.4h3.1c1 0 1.8.9 1.6 1.9l-.7 3.4A1.7 1.7 0 0 1 11.3 13H5.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function QuestionArticle({ question }: { question: RealQuestion }) {
  return (
    <article className="mx-auto w-full max-w-[760px]">
      <Link
        href="/questions"
        className="inline-flex items-center gap-1.5 text-[13px] text-black/45 transition hover:text-black"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
          <path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        All questions
      </Link>

      <h1 className="mt-5 font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-black sm:text-[34px]">
        {question.title}
      </h1>
      <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[14px] text-black/55">
        <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-medium text-black/70">
          {question.domain}
        </span>
        <span className="font-medium text-black">{question.level}</span>
        <span>· {formatQuestionYears(question.years)}</span>
        <CompanyHighlight name={question.company} />
        <span>· {question.role}</span>
      </p>
      <div className="mt-3 flex items-center gap-4 text-[12px] text-black/35">
        <span className="inline-flex items-center gap-1.5">
          <ClockIcon className="size-3.5" />
          {formatQuestionDate(question.publishedAt)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CommentIcon className="size-3.5" />
          {question.comments}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <LikeIcon className="size-3.5" />
          {question.likes}
        </span>
      </div>

      <div className="mt-8 rounded-2xl border border-black/8 bg-white p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Question</p>
        <p className="mt-3 text-[15px] leading-7 text-black/80">{question.prompt}</p>
        {question.example ? (
          <p className="mt-4 text-[14px] leading-6 text-black/55">
            <span className="font-medium text-black/70">Example. </span>
            {question.example}
          </p>
        ) : null}
      </div>

      <div className="mt-8 space-y-5 text-[15px] leading-7 text-black/70">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">How to solve it</p>
        {question.body.map((paragraph) => (
          <p key={paragraph.slice(0, 48)}>{paragraph}</p>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-black/8 bg-white p-5 sm:p-6">
        <p className="font-display text-[16px] font-medium text-black">See this on your screen in a live round?</p>
        <p className="mt-2 text-sm leading-6 text-black/50">
          Crackjob reads the question from your screen and talks you through the answer — off Zoom, Meet, and Teams
          share.
        </p>
        <AppDownloadLink className="mt-4 inline-flex h-10 items-center rounded-full bg-black px-5 text-[13px] font-semibold text-white transition hover:bg-black/85">
          Try for Free
        </AppDownloadLink>
      </div>
    </article>
  );
}
