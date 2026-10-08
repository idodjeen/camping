/**
 * Deterministic avatar colour for people without a photo: a soft fill and the
 * ink that reads on it, from the design system's accents.
 *
 * Storing a colour column would mean a migration and a seed value per person;
 * deriving it gives every user a stable, distinct colour on every device for
 * free, and anyone added later gets one automatically.
 */
const PALETTES = [
  "bg-peach text-peach-ink",
  "bg-amber text-amber-ink",
  "bg-sage text-sage-ink",
  "bg-rose text-rose-ink",
  "bg-coral text-coral-ink",
  "bg-ink text-canvas",
  "bg-line text-ink",
  "bg-cta text-on-cta",
] as const;

/**
 * The trip's five slugs, in a fixed order.
 *
 * Pure hashing is not good enough here: with 5 names over 8 palettes a
 * collision is likely (birthday problem), and in fact "nir" and "saar" hashed
 * to the same colour. Identical circles are actively misleading on the gear
 * screen, where the avatar stack is how you tell who is bringing what.
 * Indexing the known roster guarantees all five differ; anyone outside it
 * still falls back to the hash.
 *
 * Deliberately duplicated rather than imported from db/seed-data so the client
 * bundle does not pull in the entire seed corpus for five short strings.
 */
const KNOWN_SLUGS = ["ido", "nir", "saar", "or", "itzhak"] as const;

export function toneFor(slug: string): string {
  const known = KNOWN_SLUGS.indexOf(slug as (typeof KNOWN_SLUGS)[number]);
  if (known !== -1) return PALETTES[known % PALETTES.length];

  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  }
  return PALETTES[Math.abs(hash) % PALETTES.length];
}

/** First character of the Hebrew name, used inside the coloured circle. */
export function initialFor(name: string): string {
  return name.trim().charAt(0) || "?";
}
