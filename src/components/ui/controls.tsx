"use client";

import { Check } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/utils";

import { HIT } from "./tone";

/* ------------------------------------------------------------------ chip */

/**
 * A filter or choice chip, 40px drawn and 46px to tap. `count` sits after the
 * label in a quieter weight. `alert` keeps the chip coloured while inactive,
 * for "תייגו אותך": it answers a badge, so it must be findable on arrival.
 */
export function Chip({
  active,
  alert,
  count,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; alert?: boolean; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-[15px] font-semibold transition active:scale-95",
        HIT,
        active
          ? "border-ink bg-ink text-canvas"
          : alert
            ? "border-rose bg-rose text-rose-ink"
            : "border-line bg-surface text-ink",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <span dir="ltr" className={active ? "opacity-70" : "text-muted"}>
          {count}
        </span>
      )}
    </button>
  );
}

export function ChipRow({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mb-4 flex flex-wrap gap-2", className)}>{children}</div>;
}

/* ------------------------------------------------------------- segmented */

/** Two to four mutually exclusive views, like the trip settings tabs or the theme picker. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (value: T) => void;
  /** What the choice is about, for screen readers. */
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex gap-1 rounded-[24px] border-[1.5px] border-line bg-surface p-1", className)}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-10 flex-1 rounded-[20px] px-2 text-sm font-bold transition",
              HIT,
              on ? "bg-ink text-canvas" : "text-ink active:bg-line/60",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- switch */

/** An on/off switch. The label is required: it is what a screen reader announces. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        // 52x32 drawn; the ::after box makes the target 44px tall.
        "relative flex h-8 w-[52px] shrink-0 items-center rounded-full p-[3px] transition-colors after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-[''] disabled:opacity-45",
        checked ? "justify-end bg-cta" : "justify-start bg-line",
        className,
      )}
    >
      <span className="size-[26px] rounded-full bg-surface shadow-[0_1px_3px_rgb(0_0_0/0.25)]" />
    </button>
  );
}

/* -------------------------------------------------------------- checkbox */

/**
 * A round tick for "packed" and "bought". `onToggle` gets the element, so the
 * caller can celebrate from where the tap happened.
 */
export function CheckBox({
  checked,
  onToggle,
  label,
  id,
  disabled,
}: {
  id?: string;
  checked: boolean;
  onToggle: (el: Element | null) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => onToggle(e.currentTarget)}
      className="tap grid shrink-0 place-items-center rounded-full transition active:scale-90 disabled:opacity-45"
    >
      <span
        className={cn(
          "grid size-7 place-items-center rounded-full border-2 transition-colors",
          checked ? "border-sage-strong bg-sage-strong text-canvas" : "border-line bg-surface text-transparent",
        )}
      >
        <Check className="size-4" strokeWidth={3} />
      </span>
    </button>
  );
}

/* ----------------------------------------------------------------- field */

/** The look of a text input, for an <input>, <select> or <textarea> a screen builds itself. */
export const inputClass =
  "w-full rounded-[14px] border-[1.5px] border-line bg-surface px-4 text-base text-ink outline-none transition placeholder:text-muted focus:border-cta focus:ring-1 focus:ring-cta disabled:opacity-45";

/**
 * A labelled field: the label above, "לא חובה" at its end when optional, a
 * hint or an error below. Pass the control as children, or use TextField.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  action,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
  /** A link at the label's end, like "לבדוק במפה". */
  action?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-sm font-bold">
        {label}
        {optional && <span className="text-[13px] font-normal text-muted">לא חובה</span>}
        {action}
      </label>
      {children}
      {error ? (
        <p className="text-[13px] text-rose-ink">{error}</p>
      ) : (
        hint && <p className="text-[13px] leading-snug text-muted">{hint}</p>
      )}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  optional,
  action,
  className,
  ...input
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> & {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
  action?: React.ReactNode;
  className?: string;
}) {
  const auto = useId();
  const id = input.id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} optional={optional} action={action} htmlFor={id} className={className}>
      <input id={id} aria-invalid={error ? true : undefined} className={cn(inputClass, "h-[52px]")} {...input} />
    </Field>
  );
}
