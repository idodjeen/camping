"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * The commit this bundle was built from. next.config.ts inlines it with the
 * same formula /api/release uses at runtime, so the two differ only when this
 * tab is still running code from an earlier deploy.
 */
const BUILD_SHA = process.env.BUILD_SHA ?? "local";

const RELOADED_KEY = "camping:reloaded-for";

/**
 * SWR revalidates on focus, so a deploy is usually noticed a moment *after*
 * the app comes back to the foreground. Within this window, and before the
 * first tap, that still counts as the return.
 */
const JUST_RETURNED_MS = 10_000;

const TEXT_INPUTS = new Set(["text", "search", "email", "url", "tel", "number", "password"]);

/** Whether the server is on a real commit other than the one this tab runs. */
export function isOutdated(serverSha: string | undefined): serverSha is string {
  return !!serverSha && serverSha !== "local" && BUILD_SHA !== "local" && serverSha !== BUILD_SHA;
}

/** Typed text a reload would throw away: a draft message, a half-filled form. */
function hasUnsentText(): boolean {
  for (const el of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")) {
    if (el.disabled || el.readOnly) continue;
    if (el instanceof HTMLInputElement && !TEXT_INPUTS.has(el.type)) continue;
    if (el.value.trim()) return true;
  }
  return false;
}

/**
 * Reloads, unless that would lose typed text or this tab already reloaded for
 * `serverSha`. The second check is what rules out a loop: if the fresh page
 * still disagrees with the server, it stays put. Returns whether it reloaded.
 */
export function reloadOnce(serverSha: string): boolean {
  if (hasUnsentText()) return false;
  try {
    if (sessionStorage.getItem(RELOADED_KEY) === serverSha) return false;
    sessionStorage.setItem(RELOADED_KEY, serverSha);
  } catch {
    // Nowhere to record the attempt means no loop protection, so don't.
    return false;
  }
  window.location.reload();
  return true;
}

/**
 * While `serverSha` is set, reloads at the next calm moment: coming back to
 * the app, or moving to another screen. Pass null to stand down, either
 * because nothing is outdated or because the what's-new sheet is handling it.
 *
 * A phone left on one screen never navigates, and its SWR polls keep calling
 * the new API with the old bundle; this is what gets it onto the new code.
 */
export function useReloadGuard(serverSha: string | null) {
  const pathname = usePathname();
  const lastPathname = useRef(pathname);
  const lastReturn = useRef({ at: 0, tapped: true });

  // When the app last came to the foreground, and whether anything was
  // tapped or typed since.
  useEffect(() => {
    lastReturn.current = { at: Date.now(), tapped: false };
    const onVisibility = () => {
      if (document.visibilityState === "visible") lastReturn.current = { at: Date.now(), tapped: false };
    };
    const onInput = () => {
      lastReturn.current.tapped = true;
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", onInput, true);
    window.addEventListener("keydown", onInput, true);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", onInput, true);
      window.removeEventListener("keydown", onInput, true);
    };
  }, []);

  useEffect(() => {
    if (!serverSha) return;
    const { at, tapped } = lastReturn.current;
    if (!tapped && Date.now() - at < JUST_RETURNED_MS && reloadOnce(serverSha)) return;

    const onVisibility = () => {
      if (document.visibilityState === "visible") reloadOnce(serverSha);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [serverSha]);

  // A navigation Next didn't already turn into a full load (deploymentId
  // does that whenever it fetches from the new deploy).
  useEffect(() => {
    if (pathname === lastPathname.current) return;
    lastPathname.current = pathname;
    if (serverSha) reloadOnce(serverSha);
  }, [pathname, serverSha]);
}
