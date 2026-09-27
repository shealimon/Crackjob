type AudioPlayPauseButtonProps = {
  interviewOn: boolean;
  paused: boolean;
  onToggle: () => void;
};

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1.2" />
      <rect x="14" y="5" width="4" height="14" rx="1.2" />
    </svg>
  );
}

/** Small round control to the right of the audio wave — play resumes listening, pause stops it. */
export function AudioPlayPauseButton({ interviewOn, paused, onToggle }: AudioPlayPauseButtonProps) {
  const listening = interviewOn && !paused;
  const label = !interviewOn
    ? "Start interview first"
    : listening
      ? "Pause audio listening"
      : "Start audio listening";

  return (
    <button
      type="button"
      className={`ic-icon-btn ic-audio-play-btn${listening ? " is-listening" : ""}${
        interviewOn && paused ? " is-paused" : ""
      }`}
      aria-label={label}
      disabled={!interviewOn}
      onClick={onToggle}
    >
      {listening ? <PauseIcon /> : <PlayIcon />}
    </button>
  );
}
