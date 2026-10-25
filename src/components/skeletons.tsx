/**
 * Loading shapes in the layout of what is coming, never a spinner (states
 * board). After the first load, screens keep their previous data while they
 * refresh, so these show only on a cold open.
 */
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** One item row's shape: the tile, a title and a quiet line, the action pill. */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-[24px] border-[1.5px] border-line bg-surface py-3 ps-3 pe-3.5">
      <div className="size-11 shrink-0 animate-pulse rounded-tile bg-line" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-3.5 w-[55%] animate-pulse rounded-full bg-line" />
        <div className="h-3 w-[35%] animate-pulse rounded-full bg-line" />
      </div>
      <div className="h-11 w-[92px] shrink-0 animate-pulse rounded-full bg-line" />
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  /** End slot, used for the share/copy button. */
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex items-end gap-3 px-1">
      <div className="min-w-0 flex-1 leading-tight">
        <h1 className="font-display text-[30px]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
