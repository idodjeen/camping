"use client";

import { useEffect } from "react";

import { resyncSubscription } from "@/lib/push-client";

/**
 * Posts this device's push subscription again on every app launch, never
 * prompting. Renders nothing; see resyncSubscription().
 */
export function PushSync() {
  useEffect(() => {
    void resyncSubscription();
  }, []);
  return null;
}
