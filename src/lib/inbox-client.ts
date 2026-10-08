"use client";

import { useCallback } from "react";
import useSWR from "swr";

import { fetcher, send, swrConfig } from "@/lib/api";
import type { Inbox, InboxCounts } from "@/lib/notifications";
import { closeDelivered } from "@/lib/push-client";
import { pushTag, pushTagPrefix } from "@/lib/threads";
import { useTrip } from "@/lib/trip-client";

/** Which nav count a thread's tags belong to. */
function tagList(thread: string): keyof InboxCounts["tags"] | null {
  if (thread === "chat") return "chat";
  if (thread.startsWith("gear:")) return "gear";
  if (thread.startsWith("shopping:")) return "shopping";
  if (thread.startsWith("meal:")) return "meals";
  return null;
}

/** The inbox as it will be once the server has read this thread, for an instant UI. */
function withoutThread(inbox: Inbox, thread: string): Inbox {
  const group = inbox.unread.find((g) => g.thread === thread);
  if (!group) return inbox;
  const list = tagList(thread);
  const tags = { ...inbox.counts.tags };
  if (list) tags[list] = Math.max(0, tags[list] - group.tags);
  return {
    ...inbox,
    unread: inbox.unread.filter((g) => g !== group),
    counts: { ...inbox.counts, threads: Math.max(0, inbox.counts.threads - 1), tags },
  };
}

const withoutAll = (inbox: Inbox): Inbox => ({
  ...inbox,
  unread: [],
  counts: { ...inbox.counts, threads: 0, tags: { gear: 0, shopping: 0, meals: 0, chat: 0 } },
});

/**
 * The one subscription behind the bell, the pane, the banner, the nav and menu
 * badges and the app icon. They all call this, and SWR collapses them into a
 * single request per poll because the key is the same string.
 *
 * Reading goes through here too, so every way of reading a thread (a bell row,
 * a row's bubble, the room) also closes its notification on the phone.
 */
export function useInbox() {
  const { api, id } = useTrip();
  // Strings, so the callbacks below stay stable across renders.
  const key = api("/inbox");
  const readUrl = api("/inbox/read");
  const swr = useSWR<Inbox>(key, fetcher, swrConfig);
  const { mutate } = swr;

  /** `upTo`: the newest row that was on screen, so anything newer stays unread. */
  const readThread = useCallback(
    async (thread: string, upTo?: number) => {
      await mutate(
        async () => {
          await send(readUrl, "POST", upTo === undefined ? { thread } : { thread, upTo });
          return fetcher<Inbox>(key);
        },
        {
          optimisticData: (current) => (current ? withoutThread(current, thread) : current!),
          rollbackOnError: true,
          revalidate: false,
        },
      );
      void closeDelivered((tag) => tag === pushTag(id, thread));
    },
    [key, readUrl, id, mutate],
  );

  const readAll = useCallback(
    async (upTo?: number) => {
      await mutate(
        async () => {
          await send(readUrl, "POST", upTo === undefined ? { all: true } : { all: true, upTo });
          return fetcher<Inbox>(key);
        },
        {
          optimisticData: (current) => (current ? withoutAll(current) : current!),
          rollbackOnError: true,
          revalidate: false,
        },
      );
      // This trip's notifications only; other trips are still unread.
      void closeDelivered((tag) => tag.startsWith(pushTagPrefix(id)));
    },
    [key, readUrl, id, mutate],
  );

  return { ...swr, readThread, readAll };
}
