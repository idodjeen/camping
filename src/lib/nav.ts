import type { Route } from "next";
import {
  Backpack,
  Home,
  MessageCircle,
  ShieldCheck,
  ShoppingCart,
  Trophy,
  User,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Every screen of a trip, in one list. The bottom tabs, the side menu, their
 * badges and the page slide order in template.tsx are all derived from it, so
 * adding a screen or promoting one to a tab is a one-line change here.
 *
 * Hrefs are short paths inside the trip ("/gear"); useTrip().page() turns
 * them into "/t/7/gear", and local() turns the pathname back for isActive.
 */

/** Unread tags per list: `counts.tags` from /api/t/[tripId]/inbox. */
export type Unread = { gear: number; shopping: number; meals: number; chat: number };

export type NavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** A bottom tab; everything else lives in the side menu. */
  primary: boolean;
  /** Menu rows only group admins and super admins see (the admin pages, later). */
  adminOnly?: boolean;
  /** Menu rows only the super admin sees. */
  superAdminOnly?: boolean;
  /** An app-wide page such as /admin: the href is used as is, not inside the trip. */
  outsideTrip?: boolean;
};

/** Who is looking at the menu, for the rows above. */
export type MenuRoles = { isAdmin: boolean; isSuperAdmin: boolean };

export const canSee = (n: NavItem, v: MenuRoles) =>
  (!n.adminOnly || v.isAdmin || v.isSuperAdmin) && (!n.superAdminOnly || v.isSuperAdmin);

/** `P` itself when "/t/<id>P" is a real page under typedRoutes, else never. */
type Screen<P extends string> =
  `/t/0${P extends "/" ? "" : P}` extends infer U extends string
    ? U extends Route<U> ? P : never
    : never;

/** A typo or a removed page fails typecheck here instead of 404ing on a tap. */
const item = <P extends string>(href: P & Screen<P>, rest: Omit<NavItem, "href">): NavItem => ({
  href,
  ...rest,
});

/** A page outside the trip; also checked against the real routes. */
const appItem = <P extends string>(
  href: Route<P>,
  rest: Omit<NavItem, "href" | "outsideTrip">,
): NavItem => ({ href, outsideTrip: true, ...rest });

// Order is the slide order: the tabs first, right to left in Hebrew, then the
// menu from top to bottom.
export const NAV: readonly NavItem[] = [
  item("/", { label: "בית", Icon: Home, primary: true }),
  item("/gear", { label: "ציוד", Icon: Backpack, primary: true }),
  item("/chat", { label: "צ׳אט", Icon: MessageCircle, primary: true }),
  item("/meals", { label: "ארוחות", Icon: UtensilsCrossed, primary: false }),
  item("/shopping", { label: "קניות", Icon: ShoppingCart, primary: false }),
  item("/expenses", { label: "הוצאות", Icon: Wallet, primary: false }),
  item("/leaderboard", { label: "לוח התורמים", Icon: Trophy, primary: false }),
  item("/me", { label: "חשבון", Icon: User, primary: false }),
  appItem("/admin", { label: "ניהול קבוצות", Icon: ShieldCheck, primary: false, superAdminOnly: true }),
];

export const PRIMARY = NAV.filter((n) => n.primary);
export const SECONDARY = NAV.filter((n) => !n.primary);

/** Screens that belong to a nav row without having one of their own. */
const PARENT: Record<string, string> = { "/room": "/chat" };

/** The nav row a short path belongs to (/room counts as צ׳אט). */
export const navHref = (path: string) => PARENT[path] ?? path;

export const isActive = (href: string, path: string) => navHref(path) === href;

/** Position in the slide order, or -1 for a screen outside the nav. */
export const ORDER = NAV.filter((n) => !n.outsideTrip).map((n) => n.href);

/** Unread tags waiting behind one nav row. */
export function badgeFor(href: string, unread: Unread | undefined): number {
  if (!unread) return 0;
  switch (href) {
    case "/gear":
      return unread.gear;
    case "/shopping":
      return unread.shopping;
    case "/meals":
      return unread.meals;
    // The chat holds every thread and the general room, so its badge is every unread tag.
    case "/chat":
      return unread.gear + unread.shopping + unread.meals + unread.chat;
    default:
      return 0;
  }
}

/** What the menu button shows: everything waiting on the rows it hides. */
export const menuBadge = (unread: Unread | undefined, roles: MenuRoles) =>
  SECONDARY.filter((n) => canSee(n, roles)).reduce((sum, n) => sum + badgeFor(n.href, unread), 0);
