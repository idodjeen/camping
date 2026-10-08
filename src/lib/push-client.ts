"use client";

/**
 * The device side of push: the app-icon badge, the notifications already
 * sitting on the phone, and keeping this device's subscription on the server.
 *
 * Every function is feature-detected and swallows its errors: none of this is
 * worth a toast, and each API is missing somewhere (no badge on desktop
 * Firefox, no service worker in a private window, no push on iOS outside the
 * installed app).
 */

type BadgeNavigator = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/** Unread threads on the app icon; zero clears it. */
export function setAppBadge(n: number) {
  const nav = navigator as BadgeNavigator;
  try {
    const done = n > 0 ? nav.setAppBadge?.(n) : nav.clearAppBadge?.();
    void done?.catch(() => {});
  } catch {
    /* unsupported */
  }
}

async function registration() {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration("/")) ?? null;
}

/**
 * Closes delivered notifications whose tag matches, once their thread is read
 * in the app, so the phone doesn't keep announcing what you have seen.
 */
export async function closeDelivered(match: (tag: string) => boolean) {
  try {
    const reg = await registration();
    if (!reg) return;
    for (const n of await reg.getNotifications()) if (match(n.tag)) n.close();
  } catch {
    /* unsupported */
  }
}

/**
 * Posts this device's existing subscription again, never prompting. The
 * server prunes a subscription when a push service says it is gone; a device
 * that was pruned by mistake (or whose row was lost) comes back on its next
 * launch instead of going silent until someone flips the switch in חשבון.
 */
export async function resyncSubscription() {
  try {
    if (!("PushManager" in window) || Notification.permission !== "granted") return;
    const sub = await (await registration())?.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
  } catch {
    /* offline or unsupported: the next launch tries again */
  }
}
