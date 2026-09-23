/**
 * Hebrew plain-text renderings of the trip's lists.
 *
 * Pure functions with no database or React imports, deliberately: the same
 * output feeds the in-app "copy to WhatsApp" buttons (client) and the email
 * bodies (server). Building those separately guarantees the wording drifts —
 * you fix a typo in one and the other stays wrong.
 *
 * Formatting targets WhatsApp: *bold* with asterisks, emoji, no markdown
 * tables. Numbers are kept at the end of a line or prefixed with ×, because a
 * digit run in the middle of Hebrew text is where bidi reordering bites.
 */

const DONE = "✅";
const TODO = "⬜";

export type GearClaimLite = { name: string; qty: number };
export type GearItemLite = {
  name: string;
  qtyLabel: string | null;
  qtyNeeded: number | null;
  isOptional: boolean;
  isOpenQuantity: boolean;
  remaining: number | null;
  isFull: boolean;
  claims: GearClaimLite[];
};
export type GearCategoryLite = { name: string; items: GearItemLite[] };

export function formatGearList(
  categories: GearCategoryLite[],
  opts?: { onlyMissing?: boolean },
): string {
  const lines: string[] = [
    opts?.onlyMissing ? "🎒 *ציוד שעוד לא נתפס*" : "🎒 *ציוד — מחנאות 2026*",
  ];

  for (const cat of categories) {
    const items = opts?.onlyMissing
      ? cat.items.filter((i) => !i.isFull && !i.isOptional)
      : cat.items;
    if (items.length === 0) continue;

    lines.push("", `*${cat.name}*`);
    for (const item of items) {
      const who = item.claims
        .map((c) => (c.qty > 1 ? `${c.name} ×${c.qty}` : c.name))
        .join(", ");
      const label = item.qtyLabel ? `${item.name} — ${item.qtyLabel}` : item.name;

      if (item.isFull) {
        lines.push(`${DONE} ${label}${who ? ` · ${who}` : ""}`);
      } else {
        const gap = item.isOpenQuantity ? "" : ` · נשאר ${item.remaining}`;
        const opt = item.isOptional ? " (אופציונלי)" : "";
        lines.push(`${TODO} ${label}${opt}${who ? ` · ${who}` : ""}${gap}`);
      }
    }
  }

  const all = categories.flatMap((c) => c.items).filter((i) => !i.isOptional);
  const covered = all.filter((i) => i.isFull).length;
  lines.push("", `מכוסה: ${covered} מתוך ${all.length}`);
  return lines.join("\n");
}

export type ShoppingItemLite = {
  name: string;
  quantityText: string | null;
  notes: string | null;
  isBought: boolean;
  boughtBy: { name: string } | null;
};
export type ShoppingCategoryLite = { name: string; items: ShoppingItemLite[] };

export function formatShoppingList(
  categories: ShoppingCategoryLite[],
  opts?: { onlyRemaining?: boolean },
): string {
  const lines: string[] = [
    opts?.onlyRemaining ? "🛒 *מה עוד צריך לקנות*" : "🛒 *קניות — מחנאות 2026*",
  ];

  for (const cat of categories) {
    const items = opts?.onlyRemaining ? cat.items.filter((i) => !i.isBought) : cat.items;
    if (items.length === 0) continue;

    lines.push("", `*${cat.name}*`);
    for (const item of items) {
      const qty = item.quantityText ? ` — ${item.quantityText}` : "";
      const note = item.notes ? ` (${item.notes})` : "";
      const by = item.isBought && item.boughtBy ? ` · ${item.boughtBy.name}` : "";
      lines.push(`${item.isBought ? DONE : TODO} ${item.name}${qty}${note}${by}`);
    }
  }

  const all = categories.flatMap((c) => c.items);
  const bought = all.filter((i) => i.isBought).length;
  lines.push("", `נקנה: ${bought} מתוך ${all.length}`);
  return lines.join("\n");
}

export type MyClaimLite = {
  name: string;
  qty: number;
  isPacked: boolean;
  categoryName: string;
};
export type MyPersonalLite = { name: string; isPacked: boolean };

export function formatMyList(
  name: string,
  claims: MyClaimLite[],
  personal: MyPersonalLite[],
  opts?: { onlyUnpacked?: boolean },
): string {
  const lines: string[] = [`🎯 *הרשימה של ${name}*`];

  const gear = opts?.onlyUnpacked ? claims.filter((c) => !c.isPacked) : claims;
  lines.push("", "*ציוד שאני מביא*");
  if (gear.length === 0) {
    lines.push(opts?.onlyUnpacked ? "הכול ארוז 🎉" : "עוד לא תפסתי כלום");
  } else {
    for (const c of gear) {
      lines.push(
        `${c.isPacked ? DONE : TODO} ${c.name}${c.qty > 1 ? ` ×${c.qty}` : ""} · ${c.categoryName}`,
      );
    }
  }

  // The personal list is private — included only when the person themselves
  // asks for their own text, never in anything sent to the group.
  const mine = opts?.onlyUnpacked ? personal.filter((p) => !p.isPacked) : personal;
  if (mine.length > 0) {
    lines.push("", "*אישי*");
    for (const p of mine) lines.push(`${p.isPacked ? DONE : TODO} ${p.name}`);
  }

  return lines.join("\n");
}

export type MenuDayLite = {
  date: string;
  meals: {
    slot: "breakfast" | "lunch" | "dinner";
    title: string;
    description: string | null;
    items: { name: string }[];
  }[];
};

const SLOT_TEXT = { breakfast: "בוקר", lunch: "צהריים", dinner: "ערב" } as const;
const SLOT_ICON = { breakfast: "☕️", lunch: "🔥", dinner: "🌙" } as const;

export function formatMenu(days: MenuDayLite[], dayLabel: (d: string) => string): string {
  const lines: string[] = ["🍽️ *תפריט — מחנאות 2026*"];

  for (const day of days) {
    lines.push("", `*${dayLabel(day.date)}*`);
    for (const m of day.meals) {
      lines.push(`${SLOT_ICON[m.slot]} ${SLOT_TEXT[m.slot]}: ${m.title}`);
      if (m.description) lines.push(`   ${m.description}`);
      if (m.items.length > 0) lines.push(`   מצרכים: ${m.items.map((i) => i.name).join(", ")}`);
    }
  }
  return lines.join("\n");
}
