type IconProps = { className?: string };

export function WindowsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <path d="M1.5 3.4 7.2 2.5v5.1H1.5V3.4Zm0 9.2 5.7.9V8.4H1.5v4.2Zm6.5.95L14.5 14.5V8.4H8V13.55Zm0-11.2L14.5 1.5v5.9H8V2.35Z" />
    </svg>
  );
}

export function AppleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <path d="M12.4 8.3c0-1.7 1.4-2.5 1.5-2.6-0.8-1.2-2.1-1.4-2.5-1.4-1.1-.1-2.1.6-2.6.6-.6 0-1.4-.6-2.3-.6-1.2 0-2.3.7-2.9 1.8-1.2 2.2-.3 5.4.9 7.2.6.9 1.3 1.8 2.2 1.8.9 0 1.2-.6 2.3-.6 1.1 0 1.4.6 2.3.6.9 0 1.6-0.9 2.2-1.8.7-1 1-1.9 1-2 0-.1-1.9-.7-1.9-3zm-1.8-5.2c.5-.6.8-1.4.7-2.2-.7 0-1.6.5-2.1 1.1-.5.5-.9 1.4-.8 2.2.8.1 1.6-.4 2.2-1.1z" />
    </svg>
  );
}
