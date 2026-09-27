import type { LegalPageContent } from "@/lib/legal-content";
import { LEGAL_LAST_UPDATED } from "@/lib/legal-content";
import { hiw } from "@/components/help/help-ui";

export function LegalDocument({ page }: { page: LegalPageContent }) {
  return (
    <article className="w-full text-black">
      <header className="mb-5 md:mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">
          Last updated · {LEGAL_LAST_UPDATED}
        </p>
        <h1 className={`${hiw.pageTitle} mt-2`}>{page.title}</h1>
        {page.subtitle ? <p className={hiw.pageSubtitle}>{page.subtitle}</p> : null}
      </header>

      <div className="space-y-4">
        {page.sections.map((section) => (
          <section key={section.heading} className={hiw.card}>
            <h2 className={hiw.cardTitle}>{section.heading}</h2>
            {section.paragraphs?.map((para, i) => (
              <p
                key={para.slice(0, 40)}
                className={`${hiw.body} ${i > 0 ? "mt-3" : ""} ${section.bullets?.length ? "mb-0" : ""}`}
              >
                {para}
              </p>
            ))}
            {section.bullets?.length ? (
              <ul className={`${hiw.body} list-disc space-y-2 pl-5 ${section.paragraphs?.length ? "mt-3" : ""}`}>
                {section.bullets.map((item) => (
                  <li key={item.slice(0, 48)}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}
