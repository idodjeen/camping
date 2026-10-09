import { formatMoney } from "@/lib/expenses";

/**
 * What each newer kind of notification says, worded for the person reading
 * it ("החלק שלך ₪60" is a different number for everyone in the split).
 *
 * Pure, no database: the server words the bell rows and the pushes with it,
 * from the snapshot notify() stored in `notifications.data`. Snapshots, so a
 * row still reads right after its expense is edited or deleted.
 *
 * Amounts are agorot. User ids are JSON object keys, so strings.
 */
export type NotifyData = {
  expense_added: { description: string; amount: number; paidBy: number; shares: Record<string, number> };
  expense_edited: {
    description: string;
    amount: number;
    before: Record<string, number>;
    after: Record<string, number>;
  };
  expense_deleted: { description: string; amount: number };
  settlement: { from: number; to: number; fromName: string; toName: string; amount: number };
  uncovered: { missing: number };
  gear_added: { name: string };
  shopping_added: { name: string };
  bought: { name: string };
  reminder: { subject: string };
};

export type WordedKind = keyof NotifyData;

const share = (shares: Record<string, number>, me: number): number | undefined => shares[String(me)];

/**
 * The line under the headline, and a push's body. `data` comes from the
 * database, so anything missing words itself plainly instead of throwing.
 */
export function eventText(
  kind: string,
  data: unknown,
  by: { id: number; name: string },
  me: number,
): string {
  const d = (data ?? {}) as Record<string, unknown>;
  const actor = by.name;
  switch (kind as WordedKind) {
    case "expense_added": {
      const e = d as NotifyData["expense_added"];
      const mine = share(e.shares ?? {}, me);
      const base = `${actor} הוסיף/ה '${e.description}' ${formatMoney(e.amount)}`;
      if (mine !== undefined) return `${base} · החלק שלך ${formatMoney(mine)}`;
      return e.paidBy === me ? `${base} · רשום ששילמת` : base;
    }
    case "expense_edited": {
      const e = d as NotifyData["expense_edited"];
      const was = share(e.before ?? {}, me);
      const now = share(e.after ?? {}, me);
      if (was !== undefined && now === undefined) return `${actor} הסיר/ה אותך מ'${e.description}'`;
      if (was === undefined && now !== undefined) {
        return `${actor} צירף/ה אותך ל'${e.description}' · החלק שלך ${formatMoney(now)}`;
      }
      if (was !== undefined && now !== undefined && was !== now) {
        return `${actor} עדכן/ה את '${e.description}' · החלק שלך עכשיו ${formatMoney(now)} (היה ${formatMoney(was)})`;
      }
      return `${actor} עדכן/ה את '${e.description}' (${formatMoney(e.amount)})`;
    }
    case "expense_deleted": {
      const e = d as NotifyData["expense_deleted"];
      return `${actor} מחק/ה את '${e.description}' (${formatMoney(e.amount)})`;
    }
    case "settlement": {
      const s = d as NotifyData["settlement"];
      const sum = formatMoney(s.amount);
      if (s.from === me) {
        return s.to === by.id
          ? `${actor} סימן/ה שהעברת לו/ה ${sum}`
          : `${actor} סימן/ה שהעברת ל${s.toName} ${sum}`;
      }
      return s.from === by.id
        ? `${actor} סימן/ה שהעביר/ה לך ${sum}`
        : `${actor} סימן/ה ש${s.fromName} העביר/ה לך ${sum}`;
    }
    case "uncovered": {
      const u = d as NotifyData["uncovered"];
      return `${actor} ויתר/ה · שוב חסר${u.missing > 1 ? `ים ${u.missing}` : ""}`;
    }
    case "gear_added":
      return `${actor} הוסיף/ה '${(d as NotifyData["gear_added"]).name}' · מי מביא?`;
    case "shopping_added":
      return `${actor} הוסיף/ה לקניות: ${(d as NotifyData["shopping_added"]).name}`;
    case "bought":
      return `${actor} קנה/תה ${(d as NotifyData["bought"]).name}`;
    case "reminder":
      return (d as NotifyData["reminder"]).subject ?? "";
    default:
      return "";
  }
}
