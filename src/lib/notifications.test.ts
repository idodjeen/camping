import { beforeAll, describe, expect, it } from "vitest";

import type { User } from "@/db/schema";
import { getInbox, markRead } from "@/lib/notifications";
import { THREAD } from "@/lib/threads";
import { seedComment, seedGear, seedGroup, seedNotification, seedTrip } from "@/test/seed";

// Gil tags Dana on the gas canister thread of one trip. Dana is on a second
// trip of the same group too; Vered only watches.
let dana: User;
let gil: User;
let vered: User;
let camp: { id: number };
let other: { id: number };
let thread: string;

beforeAll(async () => {
  const { group, people } = await seedGroup({ dana: "admin", gil: "editor", vered: "viewer" });
  ({ dana, gil, vered } = people);
  const campTrip = await seedTrip(group, { on: [dana, gil, vered] });
  const otherTrip = await seedTrip(group, { on: [dana, gil] });
  camp = campTrip;
  other = otherTrip;

  const canister = await seedGear(campTrip, "בלון גז", { qty: 4 });
  thread = THREAD.item("gear", canister.id);
  const tag = await seedComment(campTrip, gil, "@dana יש לך את הקטן?", canister);
  await seedNotification(campTrip, dana, { kind: "mention", actor: gil, thread, comment: tag, gear: canister });
});

describe("getInbox", () => {
  it("groups my unread tag under its item, with the item's name and the message", async () => {
    const inbox = await getInbox(dana.id, camp.id, true);

    expect(inbox.unread).toHaveLength(1);
    const [group] = inbox.unread;
    expect(group.thread).toBe(thread);
    expect(group.label).toBe("בלון גז");
    expect(group.tags).toBe(1);
    expect(group.actors.map((a) => a.id)).toEqual([gil.id]);
    expect(inbox.counts.threads).toBe(1);
    expect(inbox.counts.tags.gear).toBe(1);
  });

  it("shows nothing of that trip on my other trip, but counts it as elsewhere", async () => {
    const inbox = await getInbox(dana.id, other.id, true);

    expect(inbox.unread).toEqual([]);
    expect(inbox.counts.otherTrips).toBe(1);
  });

  it("gives a viewer an empty bell", async () => {
    const inbox = await getInbox(vered.id, camp.id, false);

    expect(inbox.unread).toEqual([]);
    expect(inbox.recent).toEqual([]);
  });

  it("moves the thread from unread to recent once I read it", async () => {
    const { marked } = await markRead(dana.id, camp.id, { thread });
    const inbox = await getInbox(dana.id, camp.id, true);

    expect(marked).toBe(1);
    expect(inbox.unread).toEqual([]);
    expect(inbox.recent.map((r) => r.thread)).toEqual([thread]);
    expect(inbox.counts.tags.gear).toBe(0);
  });
});
