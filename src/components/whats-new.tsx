"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";

import { Modal } from "@/components/modal";
import { fetcher } from "@/lib/api";

type Release = { sha: string; title: string; body: string; silent: boolean };

const STORAGE_KEY = "camping:seen-release";

// localStorage throws in private windows and when site data is blocked; the
// pop-up is a nicety, so failing to remember must never break the app.
const read = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};
const write = (sha: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, sha);
  } catch {}
};

/**
 * Pops a sheet once per deployed commit.
 *
 * The first visit on a device only records the current version: a brand-new
 * user is already getting the onboarding cards and has nothing "new" to catch
 * up on. Polling means someone with the app open sees it when a deploy lands,
 * not only on their next cold start.
 */
export function WhatsNew() {
  const { data } = useSWR<Release>("/api/release", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  });
  const [release, setRelease] = useState<Release | null>(null);

  useEffect(() => {
    if (!data || data.sha === "local") return;
    const seen = read();
    if (seen === data.sha) return;
    write(data.sha);
    if (seen !== null && !data.silent && data.title) setRelease(data);
  }, [data]);

  return (
    <Modal open={release !== null} onClose={() => setRelease(null)} title="חדש באפליקציה">
      <div className="flex flex-col items-center text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-500/15 text-brand-300">
          <Sparkles className="size-6" />
        </span>
        <p className="mt-3 text-base font-semibold" dir="auto">
          {release?.title}
        </p>
        {release?.body && (
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/60" dir="auto">
            {release.body}
          </p>
        )}
        <button
          onClick={() => setRelease(null)}
          className="tap mt-5 w-full rounded-2xl bg-gradient-to-l from-brand-500 to-ocean-500 px-5 text-sm font-bold text-white shadow-lg transition active:scale-[0.98]"
        >
          הבנתי
        </button>
      </div>
    </Modal>
  );
}
