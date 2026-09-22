import type { HelpTopicContent } from "@/lib/help-content";
import { HelpInlineLinks } from "@/components/help/help-inline-link";
import { HelpSettingRows } from "@/components/help/help-setting-rows";
import { HelpShortcuts } from "@/components/help/help-shortcuts";
import { HelpStepList } from "@/components/help/help-step-list";
import { HelpUndetectRows } from "@/components/help/help-undetect-rows";
import { hiw } from "@/components/help/help-ui";

export function HelpArticle({ topic }: { topic: HelpTopicContent }) {
  const hasLead = Boolean(
    topic.shortcuts?.length || topic.paragraphs?.length || topic.settingRows?.length,
  );

  return (
    <article className="w-full text-black">
      <header className="mb-5 md:mb-6">
        <h1 className={hiw.pageTitle}>{topic.title}</h1>
        {topic.subtitle ? <p className={hiw.pageSubtitle}>{topic.subtitle}</p> : null}
      </header>

      <div className={hiw.card}>
        {topic.shortcuts?.length ? <HelpShortcuts shortcuts={topic.shortcuts} /> : null}

        {topic.paragraphs?.length ? (
          <ul className={`${hiw.body} space-y-2 ${topic.shortcuts?.length ? "mt-5" : ""}`}>
            {topic.paragraphs.map((para) => (
              <li key={para.text.slice(0, 48)} className="flex flex-wrap gap-x-1">
                <span>{para.text}</span>
                {para.links?.length ? <HelpInlineLinks links={para.links} /> : null}
              </li>
            ))}
          </ul>
        ) : null}

        {topic.settingRows?.length ? (
          <div className={topic.shortcuts?.length || topic.paragraphs?.length ? "mt-5" : ""}>
            <HelpSettingRows rows={topic.settingRows} />
          </div>
        ) : null}

        {topic.steps?.length ? (
          <div className={hasLead ? "mt-5" : ""}>
            <HelpStepList steps={topic.steps} />
          </div>
        ) : null}

        {topic.undetectRows?.length ? (
          <div className={hasLead ? "mt-5" : ""}>
            <HelpUndetectRows rows={topic.undetectRows} />
          </div>
        ) : null}

        {topic.note ? <p className={hiw.note}>{topic.note}</p> : null}
      </div>
    </article>
  );
}
