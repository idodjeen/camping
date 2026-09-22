/**
 * All seed content for מחנאות 2026.
 *
 * Quantities are written out explicitly rather than parsed from the Hebrew
 * strings at runtime: `qtyNeeded` is the max of the original range and
 * `qtyLabel` preserves the text the group actually wrote, so the UI can show
 * "2-3" while the progress maths uses 3.
 */

export type GearSeed = {
  name: string;
  qtyNeeded: number | null;
  qtyLabel?: string;
  isOptional?: boolean;
  isOpenQuantity?: boolean;
  notes?: string;
};

export type GearCategorySeed = { name: string; items: GearSeed[] };

const FROM_HOME = "להביא מהבית";

export const GEAR: GearCategorySeed[] = [
  {
    name: "מטבח",
    items: [
      { name: "כירות גז", qtyNeeded: 3, qtyLabel: "2-3" },
      { name: "בלוני גז", qtyNeeded: 4, qtyLabel: "3-4" },
      { name: "מחבת", qtyNeeded: 1 },
      { name: "סיר ומכסה", qtyNeeded: 1 },
      { name: "קרשי חיתוך", qtyNeeded: 2, qtyLabel: "2" },
      { name: "סכינים", qtyNeeded: 2, qtyLabel: "2" },
      { name: "כלים רב פעמיים", qtyNeeded: 1 },
      { name: "כף עץ", qtyNeeded: 1 },
      { name: "כפות הגשה", qtyNeeded: 3, qtyLabel: "2-3" },
      { name: "מרית / מלקחיים", qtyNeeded: 1 },
      { name: "קערות", qtyNeeded: 1 },
      { name: "נייר כסף", qtyNeeded: 1, notes: FROM_HOME },
      { name: "תבלינים", qtyNeeded: 1 },
      { name: "שמן", qtyNeeded: 1 },
      { name: "נייר סופג", qtyNeeded: 4, qtyLabel: "3-4", notes: FROM_HOME },
      { name: "מגבונים 99%", qtyNeeded: 1 },
      { name: "סקוטשים", qtyNeeded: 2, qtyLabel: "2" },
      { name: "סבון כלים", qtyNeeded: 1 },
      { name: "שקיות זבל", qtyNeeded: 1 },
      { name: "קפה", qtyNeeded: 1 },
      { name: "מקינטה גדולה / פינג'אן", qtyNeeded: 1 },
      { name: "צידניות", qtyNeeded: null, qtyLabel: "כמה שיותר", isOpenQuantity: true },
      { name: "שולחן מתקפל", qtyNeeded: 2, qtyLabel: "1-2" },
      { name: "שמרים", qtyNeeded: 1, notes: FROM_HOME },
    ],
  },
  {
    name: "פינת ישיבה ואווירה",
    items: [
      { name: "כסאות", qtyNeeded: 5, qtyLabel: "5" },
      { name: "מחצלת", qtyNeeded: 2, qtyLabel: "1-2" },
      { name: "צלייה", qtyNeeded: 2, qtyLabel: "1-2" },
      { name: "לונג שמש גדול לצלייה", qtyNeeded: 1 },
      { name: "שולחן נמוך", qtyNeeded: 1 },
      { name: "רמקול", qtyNeeded: 1 },
      { name: "תאורה", qtyNeeded: 1 },
      { name: "פריזבי", qtyNeeded: 1 },
      { name: "קלפים", qtyNeeded: 1 },
      { name: "משחקי קופסה", qtyNeeded: 1, isOptional: true },
      { name: "מצלמה", qtyNeeded: 1 },
    ],
  },
  {
    name: "מדורה",
    items: [
      { name: "עצים", qtyNeeded: null, qtyLabel: "הרבה", isOpenQuantity: true },
      { name: "פלאנצ'ה", qtyNeeded: 1 },
      { name: "סיר פויקה", qtyNeeded: 1 },
      { name: "את חפירה קטן", qtyNeeded: 1, isOptional: true },
      { name: "מצית", qtyNeeded: 1 },
    ],
  },
  {
    name: "ציוד נוסף שלפעמים שוכחים",
    items: [
      { name: "אלתוש", qtyNeeded: 1 },
      { name: "מטענים ניידים", qtyNeeded: 1 },
      { name: "מגבות", qtyNeeded: 1 },
      { name: "פנסי ראש", qtyNeeded: 1 },
      { name: "נייר טואלט", qtyNeeded: 1 },
    ],
  },
];

/**
 * Shopping names are the bare noun ("בטטות") with the amount split into
 * `quantityText`. That split is what lets the meal links below resolve by name.
 */
export type ShoppingSeed = { name: string; quantityText?: string; notes?: string };
export type ShoppingCategorySeed = { name: string; items: ShoppingSeed[] };

export const SHOPPING: ShoppingCategorySeed[] = [
  {
    name: "ירקות ופירות",
    items: [
      { name: "בטטות", quantityText: "3" },
      { name: "תפוחי אדמה", quantityText: "3" },
      { name: "בצלים גדולים", quantityText: "7" },
      { name: "סלרי" },
      { name: "קישואים", quantityText: "4" },
      { name: "פטריות" },
      { name: "פלפלים חריפים", quantityText: "2" },
      { name: "מנגולד", quantityText: "2 חבילות" },
      { name: "כוסברה", quantityText: "1-2 צרורות" },
      { name: "פטרוזיליה", quantityText: "צרור" },
      { name: "עגבניות", quantityText: "6" },
      { name: "מלפפונים", quantityText: "4" },
      { name: "לימונים", quantityText: "2" },
      { name: "חסה", quantityText: "קטנה" },
      { name: "שום", quantityText: "2 ראשים" },
    ],
  },
  {
    name: "בשר",
    items: [
      { name: "בייקון" },
      { name: "פרגיות", quantityText: 'כ-2 ק"ג' },
      { name: "אסאדו", notes: "עידודו" },
      { name: "שריר ואוסובוקו", notes: "עידודו" },
    ],
  },
  {
    name: "מזווה",
    items: [
      { name: "גאודה עיזים", quantityText: "200 גרם" },
      { name: "לחם", quantityText: "ככר לחם / חבילת פיתות" },
      { name: "שעועית לבנה", quantityText: "2 קופסאות", notes: "במלח" },
      { name: "קמח" },
      { name: "אורז" },
    ],
  },
  {
    name: "שתייה",
    items: [
      { name: "יין", quantityText: "4 בקבוקים" },
      { name: "בירה", quantityText: "3 שישיות" },
      { name: "וויסקי", quantityText: "בקבוק", notes: "או בקבוק חזק אחר" },
    ],
  },
];

export type MealSeed = {
  date: string;
  slot: "breakfast" | "lunch" | "dinner";
  title: string;
  description?: string;
  /** Names must match a `SHOPPING` item name exactly — the seed asserts this. */
  links: string[];
};

export const MEALS: MealSeed[] = [
  {
    date: "2026-10-01",
    slot: "lunch",
    title: "אוכל בדרך",
    description: "סנדוויצ'ים מהבית — כל אחד ומה שבא לו.",
    links: [],
  },
  {
    date: "2026-10-01",
    slot: "dinner",
    title: "אסאדו מופשט",
    description: "חשוף ללהבה מלטפת. ירקות מוקפצים על הפלאנצ'ה.",
    links: ["אסאדו", "קישואים", "פטריות", "בצלים גדולים", "פלפלים חריפים", "שום"],
  },
  {
    date: "2026-10-02",
    slot: "breakfast",
    title: "ירקות, לחם וגבינה",
    description: "ירקות חתוכים, לחם וגבינה קשה. קפה.",
    links: ["עגבניות", "מלפפונים", "לימונים", "גאודה עיזים", "לחם"],
  },
  {
    date: "2026-10-02",
    slot: "lunch",
    title: "פרגיות על הפלאנצ'ה",
    description: "פרגיות על הפלאנצ'ה בתיבול עדין, ירקות מדורה ולחם מאולתר בסיר.",
    links: ["פרגיות", "בטטות", "תפוחי אדמה", "בצלים גדולים", "שום", "לימונים", "קמח"],
  },
  {
    date: "2026-10-02",
    slot: "dinner",
    title: "אוסובוקו ושריר",
    description: "אוסובוקו ושריר פראיים, עטופים בירוק עז — בחייהם ובמותם. אורז.",
    links: [
      "שריר ואוסובוקו",
      "מנגולד",
      "כוסברה",
      "פטרוזיליה",
      "סלרי",
      "בצלים גדולים",
      "שום",
      "שעועית לבנה",
      "פלפלים חריפים",
      "אורז",
      "יין",
    ],
  },
  {
    date: "2026-10-03",
    slot: "breakfast",
    title: "ירקות, לחם וגבינה",
    description: "ירקות חתוכים, לחם וגבינה קשה. קפה.",
    links: ["עגבניות", "מלפפונים", "לימונים", "גאודה עיזים", "לחם"],
  },
  {
    date: "2026-10-03",
    slot: "lunch",
    title: "כריך BLT",
    description: "כריך BLT כמו בספר.",
    links: ["בייקון", "חסה", "עגבניות", "לחם"],
  },
];

export const TRIP = {
  name: "מחנאות 2026",
  startDate: "2026-10-01",
  endDate: "2026-10-03",
  lat: 33.13829,
  lng: 35.629615,
  locationName: "הגליל העליון",
};

/**
 * Roles and avatar slugs keyed by the Hebrew display name that appears in
 * ALLOWED_USERS. Emails come from that env var so they never enter the repo.
 */
export const ROSTER: Record<
  string,
  { slug: string; isAdmin?: boolean; isShopper?: boolean }
> = {
  עידו: { slug: "ido", isAdmin: true, isShopper: true },
  ניר: { slug: "nir", isShopper: true },
  סער: { slug: "saar" },
  אור: { slug: "or" },
  יצחק: { slug: "itzhak" },
};
