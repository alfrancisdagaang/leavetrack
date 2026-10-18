import Image from "next/image";

/**
 * A labelled date input with the Figma calendar icon. It stays a native `<input type="date">`
 * (keyboard, screen readers and the picker all work); the browser's own icon is made invisible and
 * stretched over the whole field, so a click anywhere opens the picker and the Figma icon shows.
 * `describedBy` and `error` follow the Field pattern: the error is an alert and sets aria-invalid.
 */
export function DateField({
  id,
  label,
  value,
  onChange,
  min,
  hint,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  hint?: string;
  error?: string;
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={id} className="block text-[13px] font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type="date"
          required
          min={min || undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`relative block h-11 w-full min-w-0 rounded-lg border bg-white pl-3 pr-10 text-sm text-ink placeholder:text-ink-muted [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 ${error ? "border-event-rejected" : "border-ink-muted"}`}
        />
        <Image
          src="/icons/calendar-days.svg"
          alt=""
          width={18}
          height={18}
          unoptimized
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
        />
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs leading-normal text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-center gap-1.5 text-xs font-medium text-event-rejected"
        >
          <Image src="/icons/circle-alert.svg" alt="" width={14} height={14} unoptimized />
          {error}
        </p>
      ) : null}
    </div>
  );
}
