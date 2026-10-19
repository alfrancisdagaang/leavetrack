/** Small line icons for the Balance Overrides page. They take their colour from the text (`currentColor`). */
const base = {
  "aria-hidden": true,
  viewBox: "0 0 24 24",
  width: 16,
  height: 16,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function CalendarIcon() {
  return (
    <svg {...base}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

export function PersonIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c.8-3.6 3.4-5.6 7-5.6s6.2 2 7 5.6" />
    </svg>
  );
}

export function NoteIcon() {
  return (
    <svg {...base}>
      <path d="M7 3.5h7.5L19 8v12.5H7z" />
      <path d="M14 3.5V8h5M10 13h6M10 16.5h6" />
    </svg>
  );
}

export function CheckCircleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...base} width={size} height={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.3 2.4 2.4 4.6-5" />
    </svg>
  );
}

export function ClockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...base} width={size} height={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 2" />
    </svg>
  );
}
