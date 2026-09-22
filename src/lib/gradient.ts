/**
 * Deterministic avatar gradient, derived by hashing the user's slug.
 *
 * Storing a colour column would mean a migration and a seed value per person;
 * hashing gives every user a stable, distinct gradient on every device for free,
 * and any user added later gets one automatically.
 */
const PALETTES = [
  "from-violet-500 to-indigo-600",
  "from-sky-400 to-blue-600",
  "from-teal-400 to-emerald-600",
  "from-fuchsia-500 to-purple-600",
  "from-amber-400 to-orange-600",
  "from-rose-400 to-pink-600",
  "from-cyan-400 to-teal-600",
  "from-lime-400 to-green-600",
] as const;

export function gradientFor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  }
  return PALETTES[Math.abs(hash) % PALETTES.length];
}

/** First character of the Hebrew name, used inside the gradient circle. */
export function initialFor(name: string): string {
  return name.trim().charAt(0) || "?";
}
