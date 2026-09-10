type IconProps = { className?: string };

export function WindowsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <path d="M1.5 3.4 7.2 2.5v5.1H1.5V3.4Zm0 9.2 5.7.9V8.4H1.5v4.2Zm6.5.95L14.5 14.5V8.4H8V13.55Zm0-11.2L14.5 1.5v5.9H8V2.35Z" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
      <circle cx="10" cy="10" r="10" className="fill-accent" />
      <path
        d="M6 10.2l2.4 2.4L14.2 7"
        stroke="var(--on-accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
      <circle cx="10" cy="10" r="10" className="fill-white/15" />
      <path
        d="M7 7l6 6M13 7l-6 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        className="text-white/55"
      />
    </svg>
  );
}

export function InfoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className ?? "size-3.5 text-white/35"} fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 7.2v3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="5.2" r="0.7" fill="currentColor" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" className={className} fill="none" aria-hidden>
      <path
        d="M2.5 4.5L6 8l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
