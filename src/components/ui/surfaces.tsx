import { ChevronLeft, RotateCw } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { Button } from "./button";
import { TONE, type Tone } from "./tone";

/* ------------------------------------------------------------------ card */

/** Surface with a 1.5px hairline: the only thing in the system that gets a border. */
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-card border-[1.5px] border-line bg-surface", className)}>{children}</div>;
}

/* ----------------------------------------------------------------- badge */

/** A small pill on a fill, like "2 חסרים" or a role. 13px, never smaller. */
export function Badge({
  tone = "peach",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-[11px] text-[13px] font-bold",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------- icon tile */

/** The rounded square an icon sits on at the start of a row: 36px in a list group, 44px in an item row. */
export function IconTile({
  tone,
  size = 44,
  children,
}: {
  tone: Tone;
  size?: 36 | 44;
  children: React.ReactNode;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center [&>svg]:size-5",
        size === 44 ? "size-11 rounded-tile" : "size-9 rounded-xl",
        TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- lists */

/** A titled card of rows separated by hairlines, as in the menu. */
export function ListGroup({
  title,
  className,
  children,
}: {
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      {title && <h2 className="px-1.5 text-[13px] font-bold text-muted">{title}</h2>}
      <div className="divide-y-[1.5px] divide-line overflow-hidden rounded-[24px] border-[1.5px] border-line bg-surface">
        {children}
      </div>
    </section>
  );
}

type RowContent = {
  icon?: React.ReactNode;
  tone?: Tone;
  title: React.ReactNode;
  /** Quiet text or a badge before the chevron. */
  trailing?: React.ReactNode;
};

function RowInner({ icon, tone = "peach", title, trailing, chevron }: RowContent & { chevron: boolean }) {
  return (
    <>
      {icon && (
        <IconTile tone={tone} size={36}>
          {icon}
        </IconTile>
      )}
      <span className="min-w-0 flex-1 truncate text-base font-semibold">{title}</span>
      {trailing && <span className="shrink-0 text-sm text-muted">{trailing}</span>}
      {/* RTL: "forward" points left. */}
      {chevron && <ChevronLeft aria-hidden className="size-[18px] shrink-0 text-muted rtl:rotate-0 ltr:rotate-180" />}
    </>
  );
}

const ROW = "flex min-h-14 w-full items-center gap-3 px-3.5 text-start transition active:bg-line/50";

/**
 * One row of a ListGroup. With `href` it is a prefetched link (switching
 * screens never waits for the server); with `onClick` a button; else static.
 */
export function ListRow(props: RowContent & { href?: Route; onClick?: () => void }) {
  const { href, onClick, ...content } = props;
  if (href) {
    return (
      <Link href={href} prefetch className={ROW}>
        <RowInner {...content} chevron />
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={ROW}>
        <RowInner {...content} chevron />
      </button>
    );
  }
  return (
    <div className={ROW}>
      <RowInner {...content} chevron={false} />
    </div>
  );
}

/**
 * A row that is its own card: a 44px tile, a title with a quiet line under
 * it, and the action at the end. The shape of gear, shopping and expense rows.
 */
export function ItemRow({
  icon,
  tone = "peach",
  title,
  subtitle,
  action,
  className,
}: {
  icon?: React.ReactNode;
  tone?: Tone;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[24px] border-[1.5px] border-line bg-surface py-3 ps-3 pe-4",
        className,
      )}
    >
      {icon && <IconTile tone={tone}>{icon}</IconTile>}
      <div className="min-w-0 flex-1 leading-snug">
        <div className="truncate text-base font-bold">{title}</div>
        {subtitle && <div className="truncate text-[13px] text-muted">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

/* ---------------------------------------------------------------- banner */

/** A full-width notice, like the viewer banner. Amber by default: notices are amber. */
export function Banner({
  tone = "amber",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn("rounded-[20px] px-3.5 py-[9px] text-center text-[13px] font-bold", TONE[tone], className)}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- states */

/** A circle icon in an accent, one line that says what is missing, one action if there is one. */
export function EmptyState({
  icon,
  tone = "sage",
  title,
  body,
  action,
  className,
}: {
  icon: React.ReactNode;
  tone?: Tone;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col items-center gap-1.5 px-4 py-6 text-center", className)}>
      <StateIcon tone={tone}>{icon}</StateIcon>
      <p className="text-[15px] font-bold">{title}</p>
      {body && <p className="max-w-xs text-[13px] leading-snug text-muted">{body}</p>}
      {action && <div className="mt-1.5">{action}</div>}
    </Card>
  );
}

/** What failed, what to do, and "לנסות שוב". */
export function ErrorState({
  icon,
  title,
  body,
  onRetry,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col items-center gap-2 p-5 text-center", className)}>
      <StateIcon tone="rose">{icon}</StateIcon>
      <p className="text-base font-bold">{title}</p>
      {body && <p className="text-sm text-muted">{body}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" icon={<RotateCw className="size-[18px]" />} onClick={onRetry}>
          לנסות שוב
        </Button>
      )}
    </Card>
  );
}

function StateIcon({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span aria-hidden className={cn("mb-1 grid size-[52px] place-items-center rounded-full [&>svg]:size-6", TONE[tone])}>
      {children}
    </span>
  );
}
