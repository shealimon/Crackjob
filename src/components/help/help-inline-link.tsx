import Link from "next/link";
import type { HelpLink } from "@/lib/help-content";
import { hiw } from "@/components/help/help-ui";

export function HelpInlineLinks({ links }: { links: HelpLink[] }) {
  if (!links.length) return null;
  return (
    <span className="inline text-sm text-black/55">
      {links.map((link, i) => (
        <span key={link.href}>
          {i > 0 ? " · " : null}
          <Link href={link.href} className={`hiw-link ${hiw.link}`}>
            {link.label}
          </Link>
        </span>
      ))}
    </span>
  );
}
