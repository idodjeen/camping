import { asc, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { gearClaims, gearItems, shoppingItems, users } from "@/db/schema";

/**
 * Contribution scoring for מחנאות 2026.
 *
 * ── Fairness ────────────────────────────────────────────────────────────────
 * Only `is_shopper` users (עידו, ניר) may set `shopping_items.bought_by`, so
 * "items bought" is an action three of the five friends are forbidden from
 * taking. Ranking everyone on it would be a grievance generator. The headline
 * score therefore counts ONLY universally-available actions — claiming gear,
 * packing it, and adding items to a list. Shopping is reported separately and
 * carries its own title.
 *
 * ── Privacy ─────────────────────────────────────────────────────────────────
 * `personal_items` is deliberately NOT imported or referenced anywhere in this
 * file. It is the one table the app promises is private, and even counting it
 * anonymously would leak that someone keeps N private items.
 */
export const SCORING = {
  /** Claiming an item at all — the core act of contributing. */
  perItem: 10,
  /** Each unit beyond the first… */
  perExtraUnit: 3,
  /**
   * …capped. `gear_claims.qty` is unbounded for open-quantity items (עצים,
   * צידניות) and nobody verifies the logs ever arrive. Uncapped, a "99 logs"
   * claim outscores everyone combined for free. Capped at +2, a 99-log claim
   * and a 3-stove claim both score 16 — so the board measures breadth of
   * commitment, which is observable, not self-reported magnitude, which isn't.
   */
  maxExtraUnits: 2,
  /** Committing is easy; actually packing it is the thing. */
  perPacked: 4,
  /** Spotting a gap in the list is a real contribution. */
  perAdded: 5,
} as const;

export type LeaderRow = {
  userId: number;
  name: string;
  slug: string;
  avatarUrl: string | null;
  isShopper: boolean;
  itemsClaimed: number;
  unitsClaimed: number;
  countedExtras: number;
  packed: number;
  added: number;
  bought: number;
  firstClaimAt: string | null;
  score: number;
  breakdown: { items: number; units: number; packed: number; added: number };
};

export type Title = {
  key: string;
  emoji: string;
  label: string;
  note: string;
  userId: number;
  name: string;
  slug: string;
  avatarUrl: string | null;
} | null;

export async function getLeaderboard() {
  const [people, claims, bought, gearAdded, shopAdded] = await Promise.all([
    db.select().from(users).orderBy(asc(users.id)),
    db
      .select({
        userId: gearClaims.userId,
        qty: gearClaims.qty,
        isPacked: gearClaims.isPacked,
        createdAt: gearClaims.createdAt,
      })
      .from(gearClaims),
    db
      .select({ userId: shoppingItems.boughtBy })
      .from(shoppingItems)
      .where(isNotNull(shoppingItems.boughtBy)),
    db
      .select({ userId: gearItems.createdBy })
      .from(gearItems)
      .where(isNotNull(gearItems.createdBy)),
    db
      .select({ userId: shoppingItems.createdBy })
      .from(shoppingItems)
      .where(isNotNull(shoppingItems.createdBy)),
  ]);

  const rows: LeaderRow[] = people.map((u) => {
    const mine = claims.filter((c) => c.userId === u.id);

    const itemsClaimed = mine.length;
    const unitsClaimed = mine.reduce((n, c) => n + c.qty, 0);
    const countedExtras = mine.reduce(
      (n, c) => n + Math.min(Math.max(c.qty - 1, 0), SCORING.maxExtraUnits),
      0,
    );
    const packed = mine.filter((c) => c.isPacked).length;
    const added =
      gearAdded.filter((g) => g.userId === u.id).length +
      shopAdded.filter((g) => g.userId === u.id).length;

    const breakdown = {
      items: itemsClaimed * SCORING.perItem,
      units: countedExtras * SCORING.perExtraUnit,
      packed: packed * SCORING.perPacked,
      added: added * SCORING.perAdded,
    };

    const firstClaim = mine
      .map((c) => c.createdAt)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    return {
      userId: u.id,
      name: u.name,
      slug: u.slug,
      avatarUrl: u.avatarUrl,
      isShopper: u.isShopper,
      itemsClaimed,
      unitsClaimed,
      countedExtras,
      packed,
      added,
      bought: bought.filter((b) => b.userId === u.id).length,
      firstClaimAt: firstClaim ? firstClaim.toISOString() : null,
      score: breakdown.items + breakdown.units + breakdown.packed + breakdown.added,
      breakdown,
    };
  });

  // Rank by score, then by breadth of commitment, then stably by name.
  rows.sort(
    (a, b) =>
      b.score - a.score ||
      b.itemsClaimed - a.itemsClaimed ||
      a.name.localeCompare(b.name, "he"),
  );

  const best = (
    key: string,
    emoji: string,
    label: string,
    pick: (r: LeaderRow) => number | null,
    note: (r: LeaderRow) => string,
  ): Title => {
    const ranked = rows
      .map((r) => ({ r, v: pick(r) }))
      .filter((x): x is { r: LeaderRow; v: number } => x.v !== null && x.v > 0)
      .sort((a, b) => b.v - a.v);
    if (ranked.length === 0) return null;
    const { r } = ranked[0];
    return {
      key,
      emoji,
      label,
      note: note(r),
      userId: r.userId,
      name: r.name,
      slug: r.slug,
      avatarUrl: r.avatarUrl,
    };
  };

  // Packing rate rewards follow-through, but a 1/1 record is not a track
  // record — prefer people with at least 3 claims, and only fall back if
  // nobody has that many yet.
  const packRanked = rows.filter((r) => r.packed > 0);
  const seasoned = packRanked.filter((r) => r.itemsClaimed >= 3);
  const packPool = seasoned.length > 0 ? seasoned : packRanked;
  const packer = packPool.sort(
    (a, b) => b.packed / b.itemsClaimed - a.packed / a.itemsClaimed || b.packed - a.packed,
  )[0];

  const earliest = rows
    .filter((r) => r.firstClaimAt)
    .sort((a, b) => a.firstClaimAt!.localeCompare(b.firstClaimAt!))[0];

  const titles: Title[] = [
    best("gear", "🎒", "מלך הציוד", (r) => r.itemsClaimed, (r) => `${r.itemsClaimed} פריטים`),
    packer
      ? {
          key: "packer",
          emoji: "📦",
          label: "האורז",
          note: `${packer.packed}/${packer.itemsClaimed} ארוז`,
          userId: packer.userId,
          name: packer.name,
          slug: packer.slug,
          avatarUrl: packer.avatarUrl,
        }
      : null,
    best("shopper", "🛒", "הקניין", (r) => r.bought, (r) => `${r.bought} קניות`),
    earliest
      ? {
          key: "quickest",
          emoji: "⚡",
          label: "הזריז",
          note: "תפס ראשון",
          userId: earliest.userId,
          name: earliest.name,
          slug: earliest.slug,
          avatarUrl: earliest.avatarUrl,
        }
      : null,
    best("initiator", "💡", "היוזם", (r) => r.added, (r) => `${r.added} פריטים שהוסיף`),
  ];

  return {
    rows,
    titles: titles.filter((t): t is NonNullable<Title> => t !== null),
    idle: rows.filter((r) => r.itemsClaimed === 0).map((r) => ({
      userId: r.userId,
      name: r.name,
      slug: r.slug,
      avatarUrl: r.avatarUrl,
    })),
    scoring: SCORING,
  };
}
