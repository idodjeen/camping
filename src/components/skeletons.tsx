export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="glass rounded-2xl p-4">
          <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-3 w-1/3 animate-pulse rounded bg-white/5" />
        </div>
      ))}
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
  /** Right-hand slot, used for the share/copy button. */
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </header>
  );
}
