import { notFound } from "next/navigation";

import { Gallery } from "./gallery";

/**
 * Every shared design part on one page, for checking them in light and dark
 * while building screens. Development only: a 404 in production, and the
 * proxy lets it through without sign-in only outside production.
 */
export default function DesignPartsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Gallery />;
}
