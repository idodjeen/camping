/**
 * Does a comment that tags nobody reach everyone else's bell?
 *
 * Runs the real createComment / listNotifications inside ONE transaction and
 * rolls it back at the end, by swapping the app's cached db for the tx. Nothing
 * is committed, and no one else can see the rows while it runs.
 */
import { asc } from "drizzle-orm";

import { db } from "@/db";
import { gearItems, users } from "@/db/schema";
import { createComment, listMentions, listNotifications } from "@/lib/comments";

const g = globalThis as unknown as { __campingDb?: unknown };
class Rollback extends Error {}

async function main() {
  const all = await db.select().from(users).orderBy(asc(users.id));
  const [item] = await db.select().from(gearItems).limit(1);
  if (all.length < 2 || !item) throw new Error("need 2+ users and a gear item");
  const author = all[0];

  await db
    .transaction(async (tx) => {
      g.__campingDb = tx;

      const body = "בדיקה — הודעה בלי תיוג";
      await createComment(author.id, "gear", item.id, body);

      console.log(`author: ${author.name}; comment tags nobody\n`);
      for (const u of all) {
        const [n, m] = await Promise.all([listNotifications(u.id), listMentions(u.id)]);
        const got = n.filter((x) => x.kind === "message" && x.body === body).length;
        console.log(
          `${u.name.padEnd(10)} notifyMessages=${String(u.notifyMessages).padEnd(5)} ` +
            `bell message rows=${got}  ${u.id === author.id ? "(author, expect 0)" : u.notifyMessages ? "(expect 1)" : "(opted out, expect 0)"}` +
            `  mentions=${m.length}`,
        );
      }
      throw new Rollback();
    })
    .catch((e) => {
      if (!(e instanceof Rollback)) throw e;
      console.log("\nrolled back — nothing was saved");
    });
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
