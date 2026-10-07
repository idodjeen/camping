import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * +1 when the document is RTL, -1 when LTR. framer-motion's `x` is physical,
 * so anything that slides toward the inline start multiplies by this: +x in
 * Hebrew, -x in English. During SSR it answers RTL, which is what the root
 * layout renders.
 */
export const startSign = () =>
  typeof document === "undefined" || document.documentElement.dir !== "ltr" ? 1 : -1;
