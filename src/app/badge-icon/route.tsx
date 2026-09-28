import { renderBadge } from "@/lib/pwa-icon";

/** The monochrome silhouette Android puts in the status bar; see renderBadge. */
export function GET() {
  return renderBadge();
}
