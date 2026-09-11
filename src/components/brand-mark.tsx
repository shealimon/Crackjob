import { CrackLogo } from "@/components/crack-logo";
import { PRODUCT_NAME } from "@/lib/constants";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span className="inline-flex items-center" aria-label={PRODUCT_NAME}>
        <CrackLogo className="size-7" />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2.5">
      <CrackLogo className="size-8 shrink-0" />
      <span className="font-display text-[17px] font-medium leading-none tracking-[-0.025em] text-current">
        {PRODUCT_NAME}
      </span>
    </span>
  );
}
