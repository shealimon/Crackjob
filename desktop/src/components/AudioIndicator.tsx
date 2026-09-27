type AudioIndicatorProps = {
  interviewOn: boolean;
  capturing?: boolean;
  hearing?: boolean;
  processing?: boolean;
};

function WaveIcon() {
  return (
    <svg className="ic-audio-wave" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect className="ic-audio-wave-bar" x="2.5" y="9" width="2.5" height="6" rx="1.2" fill="currentColor" />
      <rect className="ic-audio-wave-bar" x="7" y="6.5" width="2.5" height="11" rx="1.2" fill="currentColor" />
      <rect className="ic-audio-wave-bar" x="11.5" y="4" width="2.5" height="16" rx="1.2" fill="currentColor" />
      <rect className="ic-audio-wave-bar" x="16" y="6.5" width="2.5" height="11" rx="1.2" fill="currentColor" />
      <rect className="ic-audio-wave-bar" x="20.5" y="9" width="2.5" height="6" rx="1.2" fill="currentColor" />
    </svg>
  );
}

export function AudioIndicator({
  interviewOn,
  capturing,
  hearing,
  processing,
}: AudioIndicatorProps) {
  const state = processing
    ? "processing"
    : hearing
      ? "hearing"
      : interviewOn && capturing
        ? "waiting"
        : "idle";
  const label = processing
    ? "Fetching answer"
    : hearing
      ? "Hearing audio"
      : interviewOn && capturing
        ? "Waiting for audio"
        : "Audio idle";

  return (
    <span
      className={`ic-icon-btn ic-audio-indicator-btn is-${state}`}
      aria-label={label}
      role="status"
    >
      <WaveIcon />
    </span>
  );
}
