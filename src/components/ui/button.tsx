import { cn } from "@/lib/utils";

import { HIT, TONE, type Tone } from "./tone";

type Variant = "primary" | "secondary" | "soft" | "danger";
type Size = "md" | "sm" | "xs";

const VARIANT: Record<Exclude<Variant, "soft">, string> = {
  // The one main action on a screen.
  primary: "bg-cta text-on-cta",
  secondary: "border-[1.5px] border-line bg-surface text-ink",
  // Destructive: the strong rose with the canvas colour on it, never the cta.
  danger: "bg-rose-strong text-canvas",
};

const SIZE: Record<Size, string> = {
  md: "h-[52px] px-[18px] text-base",
  sm: "h-11 px-[18px] text-[15px]",
  xs: cn("h-10 px-4 text-sm", HIT),
};

export type ButtonProps = React.ComponentProps<"button"> & {
  variant?: Variant;
  /** The accent for `variant="soft"`. */
  tone?: Tone;
  size?: Size;
  /** Stretch to the width of the container. */
  full?: boolean;
  /** While the action runs: dimmed, not clickable, and `busyLabel` in place of the children. */
  busy?: boolean;
  busyLabel?: React.ReactNode;
  icon?: React.ReactNode;
};

/**
 * Every button in the app. States follow the states board: normal, busy
 * (60%, a "...ים..." label) and disabled (45%).
 */
export function Button({
  variant = "primary",
  tone = "peach",
  size = "md",
  full,
  busy,
  busyLabel,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-bold transition active:scale-[0.98] disabled:pointer-events-none",
        variant === "soft" ? TONE[tone] : VARIANT[variant],
        SIZE[size],
        full && "w-full",
        busy ? "opacity-60" : "disabled:opacity-45",
        className,
      )}
      {...props}
    >
      {icon}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}

/** A round 46px icon button, like the header's: always pass an aria-label. */
export function IconButton({
  className,
  children,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label": string }) {
  return (
    <button
      type={type}
      className={cn(
        "grid size-[46px] shrink-0 place-items-center rounded-full border-[1.5px] border-line bg-surface text-ink transition active:scale-95",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
