"use client";

import { useEffect } from "react";

import { send } from "@/lib/api";

/**
 * Keeps this device's push subscription alive, quietly, on every app load.
 *
 * Two failures this repairs, both of which used to leave a device silent while
 * the switch in חשבון still read "פעיל":
 *
 * 1. The service worker was only ever registered inside the opt-in switch. If
 *    the registration went away — cleared site data, a browser tidying up an
 *    installed app it thought was idle — nothing brought it back, and no push
 *    could be delivered even though the server still had the subscription.
 * 2. `sendPush` prunes an endpoint the moment a push to it comes back 404 or
 *    410. A single bad stretch can therefore delete a subscription the browser
 *    still considers live, and nothing ever told the server about it again.
 *
 * Re-posting what the browser actually holds fixes both: the upsert is keyed
 * on the endpoint, so an already-known device is a no-op.
 *
 * It deliberately never asks for permission. That has to come from a tap (iOS
 * refuses otherwise), which is what the switch is for.
 */
export function PushSync() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        // Permission was never granted, or this browser has no push at all.
        if (Notification.permission !== "granted" || !reg.pushManager) return;

        const sub = await reg.pushManager.getSubscription();
        if (sub) await send("/api/push", "POST", { subscription: sub.toJSON() });
      } catch {
        // Nothing to tell the user: they did not ask for this, and the switch
        // in חשבון reports the real state next time they look.
      }
    })();
  }, []);

  return null;
}
