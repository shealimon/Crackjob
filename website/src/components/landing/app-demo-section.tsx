import { AppPreview } from "@/components/landing/app-preview";

/** Full Crackjob app demo — directly under the hero. */
export function AppDemoSection() {
  return (
    <section
      id="demo"
      className="relative mt-1 px-3 pb-16 pt-2 md:mt-2 md:px-6 md:pb-24 md:pt-3"
      aria-label="Crackjob app demo"
    >
      <div className="mx-auto w-full max-w-[90rem]">
        <AppPreview />
      </div>
    </section>
  );
}
