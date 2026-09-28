import {
  Backpack,
  Home,
  MessageCircle,
  ShoppingCart,
  Trophy,
  User,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/** The unread-tag counts `/api/me` returns, one per commentable list. */
export type Unread = { gear: number; shopping: number; meals: number; general: number };

export type NavItem = {
  href: "/" | "/gear" | "/chat" | "/meals" | "/shopping" | "/expenses" | "/leaderboard" | "/me";
  label: string;
  Icon: LucideIcon;
  /** Primary items get a tab in the bottom bar; the rest live in the menu. */
  primary: boolean;
};

/**
 * Every destination in the app, in tab order.
 *
 * One list rather than three: the bottom bar, the menu and the page-transition
 * direction all read it, so a new screen cannot end up animating the wrong way
 * or silently missing a badge — which is exactly what happened while the
 * transition order was a second hand-kept copy.
 *
 * Only three are primary. Eight tabs across a phone left each one about 40px
 * of a `max-w-md` row, which is below a comfortable tap target; the other five
 * moved behind the menu button in the header.
 */
export const NAV: readonly NavItem[] = [
  { href: "/", label: "בית", Icon: Home, primary: true },
  { href: "/gear", label: "ציוד", Icon: Backpack, primary: true },
  { href: "/chat", label: "צ׳אט", Icon: MessageCircle, primary: true },
  { href: "/meals", label: "ארוחות", Icon: UtensilsCrossed, primary: false },
  { href: "/shopping", label: "קניות", Icon: ShoppingCart, primary: false },
  { href: "/expenses", label: "הוצאות", Icon: Wallet, primary: false },
  { href: "/leaderboard", label: "לוח התורמים", Icon: Trophy, primary: false },
  { href: "/me", label: "חשבון", Icon: User, primary: false },
];

export const PRIMARY = NAV.filter((n) => n.primary);
export const SECONDARY = NAV.filter((n) => !n.primary);

/** Tab order for the slide direction; /room rides along with the chat tab. */
export const ORDER = NAV.map((n) => n.href);

/** Is this the lit destination? The chat room hangs off the chat tab. */
export const isActive = (href: string, pathname: string) =>
  pathname === href || (href === "/chat" && pathname === "/room");

/** How many unread tags sit behind one destination. */
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
      return unread.gear + unread.shopping + unread.meals + unread.general;
    default:
      return 0;
  }
}

/**
 * The menu button's own badge: everything waiting behind a screen you can no
 * longer see. Without it, moving קניות off the bar would hide its tags too.
 */
export const menuBadge = (unread: Unread | undefined) =>
  SECONDARY.reduce((sum, n) => sum + badgeFor(n.href, unread), 0);
