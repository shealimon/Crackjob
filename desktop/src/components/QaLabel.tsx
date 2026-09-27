import type { AnswerSource } from "../lib/types";

export function QuestionLabel({
  source = "voice",
  interactiveHandsOn = false,
}: {
  source?: AnswerSource;
  interactiveHandsOn?: boolean;
}) {
  if (interactiveHandsOn) {
    return (
      <span
        className="ic-qa-label ic-qa-label-q ic-qa-label-q-interactive"
        aria-label="Interactive question"
      >
        <span className="ic-qa-dot" aria-hidden />
      </span>
    );
  }
  const isShot = source === "screenshot";
  const isText = source === "text";
  const label = isShot ? "Screenshot question" : isText ? "Chat question" : "Voice question";
  const tone = isShot ? "shot" : isText ? "text" : "voice";
  return (
    <span
      className={`ic-qa-label ic-qa-label-q ic-qa-label-q-${tone}`}
      aria-label={label}
    >
      <span className="ic-qa-dot" aria-hidden />
    </span>
  );
}

export function AnswerLabel() {
  return (
    <span className="ic-qa-label ic-qa-label-a" aria-label="Answer">
      <span className="ic-qa-dot" aria-hidden />
    </span>
  );
}
