"use client";

import { ErrorCard } from "@/components/error-card";

/**
 * A page outside any trip that threw (/, /trips, an old link's redirect).
 * Trip screens have their own error.tsx inside the trip layout, which keeps
 * the bottom nav; this one is the fallback above it.
 */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="pt-10">
      <ErrorCard error={error} retry={retry} />
    </div>
  );
}
