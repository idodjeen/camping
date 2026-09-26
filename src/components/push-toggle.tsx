"use client";

import { useEffect, useState } from "react";

import { toast } from "@/components/toast";
import { ApiError, send } from "@/lib/api";
import { cn } from "@/lib/utils";

type State = "loading" | "unsupported" | "needs-install" | "denied" | "off" | "on";

/** VAPID keys travel as URL-safe base64; `subscribe` wants raw bytes. */
function keyToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // iPadOS reports itself as a Mac with a touch screen.
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

/**
 * Opt in to Web Push on this device.
 *
 * `Notification.requestPermission()` must run inside a tap handler on iOS, so
 * subscribing is never automatic — the switch is the user gesture. On iOS the
 * API only exists once the site is installed to the Home Screen, hence the
 * separate "needs-install" state with instructions.
 */
export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (isIos() && !isStandalone()) return setState("needs-install");
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return setState("unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      setState((await currentSubscription()) ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    // Permission first, synchronously off the tap — before any other await.
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState(permission === "denied" ? "denied" : "off");
      return;
    }
    const { publicKey } = await fetch("/api/push").then((r) => r.json());
    if (!publicKey) throw new ApiError(500, "ההתראות עדיין לא הוגדרו בשרת");

    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyToBytes(publicKey),
      }));

    await send("/api/push", "POST", { subscription: sub.toJSON(), test: true });
    setState("on");
  }

  async function disable() {
    const sub = await currentSubscription();
    if (sub) {
      await send("/api/push", "DELETE", { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    setState("off");
  }

  async function flip() {
    if (busy) return;
    setBusy(true);
    try {
      await (state === "on" ? disable() : enable());
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "לא הצלחנו להפעיל התראות");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return null;

  const on = state === "on";
  const interactive = state === "on" || state === "off";
  const hint = {
    "needs-install": "באייפון: שיתוף ← ״הוסף למסך הבית״, ואז לפתוח את האפליקציה משם",
    unsupported: "הדפדפן הזה לא תומך בהתראות פוש",
    denied: "ההרשאה נחסמה — אפשר לשנות בהגדרות המכשיר",
    off: "קבלו התראה גם כשהאפליקציה סגורה",
    on: "המכשיר הזה יקבל התראות",
  }[state];

  return (
    <section className="mb-7">
      <h2 className="mb-2 px-1 text-sm font-semibold text-white/50">התראות פוש</h2>
      <button
        role="switch"
        aria-checked={on}
        disabled={!interactive || busy}
        onClick={flip}
        className="tap glass flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-start disabled:opacity-60"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">התראות במכשיר</span>
          <span className="block text-[11px] text-white/40">{hint}</span>
        </span>
        <span
          className={cn(
            "relative h-6 w-10 shrink-0 rounded-full transition",
            on ? "bg-brand-500" : "bg-white/15",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-5 rounded-full bg-white transition-all",
              on ? "start-[18px]" : "start-0.5",
            )}
          />
        </span>
      </button>
    </section>
  );
}
