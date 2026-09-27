import type { HelpUndetectRow } from "@/lib/help-content";
import { hiw } from "@/components/help/help-ui";

export function HelpUndetectRows({ rows }: { rows: HelpUndetectRow[] }) {
  return (
    <ul className="space-y-4">
      {rows.map((row) => (
        <li key={row.riskTitle} className={`${hiw.body} border-b border-black/6 pb-4 last:border-0 last:pb-0`}>
          <p>
            <span className={hiw.bodyStrong}>{row.fixTitle}</span> — {row.fixBody}
          </p>
          <p className="mt-1">
            <span className={hiw.bodyStrong}>{row.riskTitle}</span> — {row.riskBody}
          </p>
        </li>
      ))}
    </ul>
  );
}
