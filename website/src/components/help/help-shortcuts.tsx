import type { HelpShortcut } from "@/lib/help-content";
import { hiw } from "@/components/help/help-ui";

function Kbd({ children }: { children: string }) {
  return <kbd className={hiw.kbd}>{children}</kbd>;
}

export function HelpShortcuts({ shortcuts }: { shortcuts: HelpShortcut[] }) {
  return (
    <div className={hiw.tableWrap}>
      <table className="w-full text-left">
        <thead>
          <tr className={hiw.tableHeadRow}>
            <th className={hiw.tableHead}>Do this</th>
            <th className={hiw.tableHead}>Keys</th>
          </tr>
        </thead>
        <tbody>
          {shortcuts.map((row) => (
            <tr key={row.action} className={hiw.tableRow}>
              <td className="px-3 py-2.5 text-sm font-semibold text-black">{row.action}</td>
              <td className={hiw.tableCell}>
                <span className="inline-flex flex-wrap items-center gap-1">
                  {row.keys.map((key) => (
                    <Kbd key={`${row.action}-${key}`}>{key}</Kbd>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
