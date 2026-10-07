"use client";

import { ErrorCard } from "@/components/error-card";

/**
 * A page that threw. This renders inside (app)/layout.tsx, so the bottom nav
 * and the rest of the shell stay, and the other tabs keep working. The
 * layout's own widgets are covered by WidgetBoundary instead.
 */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="pt-10">
      <ErrorCard error={error} retry={retry} />
    </div>
  );
}
