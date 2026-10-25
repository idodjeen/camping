/**
 * The five soft accents, each as a fill plus the ink that reads on it
 * (design system: "put text on a fill only in its own ink or in ink").
 * Written out in full so Tailwind sees every class.
 *
 * Meaning: sage done and shopping, rose gear and missing, amber meals and
 * notices, peach the trip itself and me, coral actions and settings.
 */
export type Tone = "peach" | "rose" | "sage" | "amber" | "coral";

export const TONE: Record<Tone, string> = {
  peach: "bg-peach text-peach-ink",
  rose: "bg-rose text-rose-ink",
  sage: "bg-sage text-sage-ink",
  amber: "bg-amber text-amber-ink",
  coral: "bg-coral text-coral-ink",
};

/**
 * For controls drawn 40px tall (chips, segments, small buttons): an invisible
 * box 3px past every edge, so the tap target is 46px without changing the look.
 */
export const HIT = "relative after:absolute after:-inset-[3px] after:content-['']";
