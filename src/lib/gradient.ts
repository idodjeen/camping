/**
 * Deterministic avatar gradient for people without a photo.
 *
 * Storing a colour column would mean a migration and a seed value per person;
 * deriving it gives every user a stable, distinct gradient on every device for
 * free, and anyone added later gets one automatically.
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

/**
 * The trip's five slugs, in a fixed order.
 *
 * Pure hashing is not good enough here: with 5 names over 8 palettes a
 * collision is likely (birthday problem), and in fact "nir" and "saar" hashed
 * to the same green. Identical circles are actively misleading on the gear
 * screen, where the avatar stack is how you tell who is bringing what.
 * Indexing the known roster guarantees all five differ; anyone outside it
 * still falls back to the hash.
 *
 * Deliberately duplicated rather than imported from db/seed-data so the client
 * bundle does not pull in the entire seed corpus for five short strings.
 */
const KNOWN_SLUGS = ["ido", "nir", "saar", "or", "itzhak"] as const;

export function gradientFor(slug: string): string {
  const known = KNOWN_SLUGS.indexOf(slug as (typeof KNOWN_SLUGS)[number]);
  if (known !== -1) return PALETTES[known % PALETTES.length];

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
