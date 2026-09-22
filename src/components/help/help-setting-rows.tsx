import type { HelpSettingRow } from "@/lib/help-content";
import { HelpInlineLinks } from "@/components/help/help-inline-link";
import { hiw } from "@/components/help/help-ui";

export function HelpSettingRows({ rows }: { rows: HelpSettingRow[] }) {
  return (
    <div className="divide-y divide-black/6">
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start sm:gap-6"
        >
          <p className={hiw.bodyStrong}>{row.label}</p>
          <div className="min-w-0">
            <p className={hiw.body}>{row.description}</p>
            {row.examples?.length ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {row.examples.map((example) => (
                  <span key={example} className={hiw.chip}>
                    {example}
                  </span>
                ))}
              </div>
            ) : null}
            {row.links?.length ? (
              <div className="mt-2">
                <HelpInlineLinks links={row.links} />
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
