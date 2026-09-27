import type { HelpStep } from "@/lib/help-content";
import { HelpInlineLinks } from "@/components/help/help-inline-link";
import { hiw } from "@/components/help/help-ui";

export function HelpStepList({ steps }: { steps: HelpStep[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((step, index) => (
        <li key={step.title} className="flex gap-3">
          <span className={hiw.stepNum} aria-hidden>
            {index + 1}
          </span>
          <div className="min-w-0 pt-0.5">
            <h3 className={hiw.stepTitle}>{step.title}</h3>
            {step.body ? <p className={`mt-1 ${hiw.body}`}>{step.body}</p> : null}
            {step.links?.length ? (
              <div className="mt-1">
                <HelpInlineLinks links={step.links} />
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
