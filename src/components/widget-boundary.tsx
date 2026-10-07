"use client";

import { catchError, type ErrorInfo } from "next/error";
import { useEffect } from "react";

/**
 * For the widgets in (app)/layout.tsx, which sit above every error.tsx.
 * Without it, one of them throwing (an old bundle reading a response whose
 * shape changed, say) blanks the whole app. Logs and renders nothing; the
 * boundary resets on the next navigation, which tries the widget again.
 */
export const WidgetBoundary = catchError(function WidgetCrashed(
  { name }: { name: string },
  { error }: ErrorInfo,
) {
  useEffect(() => {
    console.error(`${name} crashed and is hidden until the next navigation:`, error);
  }, [name, error]);
  return null;
});
