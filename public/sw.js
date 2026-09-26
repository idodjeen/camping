/* Service worker: exists only to receive Web Push. No caching, no fetch handler. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
    self.registration.showNotification(data.title || "מחנאות 2026", {
      body: data.body || "",
      icon: "/pwa-icon/192",
      // Android draws this silhouette in the status bar. Without it the slot
      // falls back to a generic dot, which says nothing about who it is from.
      badge: "/badge-icon",
      tag: data.tag,
      dir: "rtl",
      lang: "he",
      data: { url: data.url || "/" },
    }),
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

/** VAPID keys travel as URL-safe base64; `subscribe` wants raw bytes. */
function keyToBytes(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * The browser retired this device's subscription and wants a new one.
 *
 * Android does this on its own schedule, and until now nothing listened: the
 * endpoint in the database went stale, every push to it 410'd, and the device
 * fell silent while the switch in חשבון still read "פעיל". The only way back
 * was to toggle it off and on by hand.
 *
 * Chrome hands the old subscription over with its key on it. Where it does
 * not, the key is fetched instead — and if that fails too (no session in this
 * worker's cookie jar, say), the sync on the next app load still recovers it.
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      let key = event.oldSubscription?.options?.applicationServerKey;
      if (!key) {
        const res = await fetch("/api/push", { credentials: "include" });
        if (!res.ok) return;
        const { publicKey } = await res.json();
        if (!publicKey) return;
        key = keyToBytes(publicKey);
      }

      const sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });

      await fetch("/api/push", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          // So the row for the endpoint being replaced goes now, rather than
          // waiting to be pruned by a push that fails against it.
          replaces: event.oldSubscription?.endpoint,
        }),
      });
    })(),
  );
});
