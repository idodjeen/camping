"use client";

import { ErrorCard } from "@/components/error-card";

/**
 * A trip screen that threw. This renders inside the trip layout, so the bottom
 * nav and the rest of the shell stay, and the other tabs keep working. The
 * layout's own widgets are covered by WidgetBoundary instead.
 *
 * (app)/error.tsx sits above the trip layout, so without this one a crash in
 * any tab would replace the whole shell, nav included.
 */
export default function TripError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="pt-10">
      <ErrorCard error={error} retry={retry} />
    </div>
  );
}
