"use client";

import "./globals.css";

import { ErrorCard } from "@/components/error-card";

/**
 * Last resort: a throw in the root layout, or in (app)/layout.tsx itself,
 * which (app)/error.tsx sits inside and so can't catch. It replaces the whole
 * document, so it brings its own <html> and stylesheet.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="he" dir="rtl" className="dark">
      <body className="font-sans antialiased">
        <title>מחנאות 2026</title>
        <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center px-6 py-10">
          <ErrorCard error={error} retry={retry} />
        </main>
      </body>
    </html>
  );
}
