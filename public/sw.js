/* Service worker: exists only to receive Web Push. No caching, no fetch handler. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/**
 * One notification per thread. The server tags every push with its trip and
 * thread, and a notification with the same tag replaces the one already on the
 * screen. It only buzzes again (renotify) if the one it replaces is more than
 * two minutes old, so a burst (twelve "bought" in a row) buzzes once and then
 * updates quietly. iPhones ignore renotify, so a replacement may arrive
 * silently there.
 */
const RENOTIFY_AFTER_MS = 2 * 60 * 1000;

async function shouldRenotify(tag) {
  if (!tag) return false;
  const existing = await self.registration.getNotifications({ tag });
  if (existing.length === 0) return true;
  // Safari may not report a timestamp; treat that as old, so it still alerts.
  const newest = Math.max(...existing.map((n) => n.timestamp || 0));
  return Date.now() - newest > RENOTIFY_AFTER_MS;
}

/** Unread threads on the app icon. Missing on many platforms, so never fatal. */
async function setBadge(count) {
  if (typeof count !== "number") return;
  try {
    if (count > 0 && self.navigator.setAppBadge) await self.navigator.setAppBadge(count);
    else if (count <= 0 && self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
  } catch {
    /* unsupported */
  }
}

// Safari requires every push to end in a visible notification (userVisibleOnly);
// skipping showNotification gets the subscription revoked after a few pushes.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    (async () => {
      const tag = data.tag || undefined;
      let renotify = false;
      try {
        renotify = await shouldRenotify(tag);
      } catch {
        /* getNotifications unsupported: show it as a fresh one */
      }

      await self.registration.showNotification(data.title || "מחנאות 2026", {
        body: data.body || "",
        icon: "/pwa-icon/192",
        tag,
        // renotify without a tag throws, so it is only ever set with one.
        renotify: Boolean(tag) && renotify,
        timestamp: Date.now(),
        dir: "rtl",
        lang: "he",
        data: { url: data.url || "/" },
      });
      await setBadge(data.badge);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of open) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
