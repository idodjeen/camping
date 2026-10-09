/**
 * Unlike a layout, a template remounts on each navigation, so this plays the
 * `page-in` fade (globals.css) every time a trip screen changes: a short
 * opacity-only CSS animation, 40% to 100% in 150 ms.
 *
 * Opacity only, and nothing left behind once it ends: no transform or filter
 * stays on this wrapper, so a `position: fixed` child is positioned against
 * the screen as usual and sticky bars keep their blur. It starts at 40%
 * rather than 0 so there is never a blank frame between two screens, and it
 * needs no JavaScript, so a page is visible before it hydrates.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
