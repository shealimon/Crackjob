"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { CompanyHighlight } from "@/components/questions/company-highlight";
import {
  featuredQuestionCompanies,
  filterRealQuestions,
  formatQuestionDate,
  formatQuestionYears,
  QUESTIONS_PAGE_SIZE,
  REAL_QUESTIONS,
  type QuestionSort,
} from "@/lib/real-questions";

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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.2 10.2 13.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function paginationItems(page: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const items: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) items.push("ellipsis");
  for (let n = start; n <= end; n += 1) items.push(n);
  if (end < totalPages - 1) items.push("ellipsis");
  items.push(totalPages);
  return items;
}

export function QuestionsBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const companies = useMemo(() => featuredQuestionCompanies(), []);

  const company = params.get("company") ?? "";
  const query = params.get("q") ?? "";
  const sortParam = params.get("sort");
  const sort = (
    sortParam === "oldest" || sortParam === "newest" ? sortParam : "level"
  ) as QuestionSort;
  const page = Math.max(1, Number(params.get("page") || "1") || 1);

  const filtered = useMemo(
    () => filterRealQuestions(REAL_QUESTIONS, { company: company || undefined, query, sort }),
    [company, query, sort],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / QUESTIONS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * QUESTIONS_PAGE_SIZE, safePage * QUESTIONS_PAGE_SIZE);

  function setParams(next: { company?: string; q?: string; sort?: QuestionSort; page?: number }) {
    const search = new URLSearchParams();
    const nextCompany = next.company === undefined ? company : next.company;
    const nextQuery = next.q === undefined ? query : next.q;
    const nextSort = next.sort === undefined ? sort : next.sort;
    const nextPage = next.page === undefined ? 1 : next.page;
    if (nextCompany) search.set("company", nextCompany);
    if (nextQuery.trim()) search.set("q", nextQuery);
    if (nextSort !== "level") search.set("sort", nextSort);
    if (nextPage > 1) search.set("page", String(nextPage));
    const qs = search.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="mx-auto w-full max-w-[880px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {companies.map((item) => {
            const selected = company.toLowerCase() === item.company.toLowerCase();
            return (
              <button
                key={item.company}
                type="button"
                onClick={() => setParams({ company: selected ? "" : item.company, page: 1 })}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] transition ${
                  selected
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-white text-black/60 hover:border-black/20 hover:text-black"
                }`}
              >
                {item.company} ({item.count})
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label className="relative flex-1 sm:w-[220px]">
            <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-black/35">
              <SearchIcon className="size-3.5" />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setParams({ q: event.target.value, page: 1 })}
              placeholder="search anything"
              className="h-9 w-full rounded-full border border-black/10 bg-white pl-8 pr-3 text-[13px] text-black outline-none placeholder:text-black/35 focus:border-black/25"
            />
          </label>
          <label className="relative">
            <span className="sr-only">Sort questions</span>
            <select
              value={sort}
              onChange={(event) => setParams({ sort: event.target.value as QuestionSort, page: 1 })}
              className="h-9 appearance-none rounded-full border border-black/10 bg-white py-0 pl-3 pr-8 text-[13px] text-black/60 outline-none focus:border-black/25"
            >
              <option value="level" className="bg-white">
                sort by: intern → 20 yrs
              </option>
              <option value="newest" className="bg-white">
                sort by: newest
              </option>
              <option value="oldest" className="bg-white">
                sort by: oldest
              </option>
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-2.5 grid place-items-center text-black/40">
              <svg viewBox="0 0 12 12" className="size-3" fill="none" aria-hidden>
                <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </span>
          </label>
        </div>
      </div>

      <ul className="mt-8">
        {pageItems.length === 0 ? (
          <li className="border-t border-black/8 py-16 text-center text-sm text-black/45">
            No write-ups match that filter.
          </li>
        ) : (
          pageItems.map((item) => (
            <li key={item.slug} className="border-t border-black/8">
              <Link href={`/questions/${item.slug}`} className="group block py-6">
                <h2 className="font-display text-[22px] font-semibold leading-snug tracking-[-0.03em] text-black transition group-hover:text-black/70 sm:text-[24px]">
                  {item.title}
                </h2>
                <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] leading-6 text-black/55">
                  <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-medium text-black/70">
                    {item.domain}
                  </span>
                  <span className="font-medium text-black">{item.level}</span>
                  <span>· {formatQuestionYears(item.years)}</span>
                  <CompanyHighlight name={item.company} />
                  <span>· {item.role}</span>
                </p>
                <p className="mt-2 text-[14px] leading-6 text-black/70">{item.prompt}</p>
                <div className="mt-3 flex items-center gap-4 text-[12px] text-black/35">
                  <span className="inline-flex items-center gap-1.5">
                    <ClockIcon className="size-3.5" />
                    {formatQuestionDate(item.publishedAt)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CommentIcon className="size-3.5" />
                    {item.comments}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <LikeIcon className="size-3.5" />
                    {item.likes}
                  </span>
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>

      {filtered.length > 0 ? (
        <nav
          className="mt-4 flex items-center justify-center gap-2 border-t border-black/8 pt-8"
          aria-label="Questions pages"
        >
          {paginationItems(safePage, totalPages).map((item, index) =>
            item === "ellipsis" ? (
              <span key={`e-${index}`} className="px-1 text-sm text-black/35">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => setParams({ page: item })}
                aria-current={item === safePage ? "page" : undefined}
                className={`grid size-9 place-items-center rounded-full text-[13px] font-medium transition ${
                  item === safePage
                    ? "bg-black text-white"
                    : "border border-black/10 text-black/55 hover:border-black/20 hover:text-black"
                }`}
              >
                {item}
              </button>
            ),
          )}
          {safePage < totalPages ? (
            <button
              type="button"
              onClick={() => setParams({ page: safePage + 1 })}
              aria-label="Next page"
              className="grid size-9 place-items-center rounded-full border border-black/10 text-black/55 transition hover:border-black/20 hover:text-black"
            >
              <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
