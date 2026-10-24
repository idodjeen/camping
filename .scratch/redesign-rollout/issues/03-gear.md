# A03: Gear

**What to build:** The gear screen matches its board: "מחכים למישהו" first with one-tap "אני מביא", "כבר מכוסה" below with who brings each item, and the "פריט חדש" button for editors. The chips become הכל / חסר / אני מביא / הרשימה שלי, plus תייגו אותך when there is something to find. The my-gear view is restyled; the personal list view keeps working as it is (Spec B redesigns it).

**Blocked by:** A02: Shared design parts and states

**Status:** done 2026-10-24

- [x] Taking, lowering and releasing gear work as before, including the "someone took the last one" message
- [x] Chip labels are exactly הכל, חסר, אני מביא, הרשימה שלי, and תייגו אותך only when present
- [x] The copy buttons still copy the full list, my gear or the personal list
- [x] Viewers see no take or add buttons
- [x] The gear board on the canvas is updated to show the four chips
- [x] Done per Spec A's definition of done: typecheck, build and tests pass; checked in the preview at phone width in light and dark; no old class names left on the touched screens; board updated if the screen differs from it; PR title carries `[no-popup]`; not merged by the agent

## Comments

2026-10-24, A03 build (branch `claude/a03-gear`). Where the screen differs from the board:

- **Category headings.** Inside "מחכים למישהו" and "כבר מכוסה" the items stay grouped by category under a quiet 13px heading, as the old screen and the copied list are. The board's sample is too short to show groups. Each category gets a tile colour by its place in the list and an icon guessed from its name (fire, pot, chair, moon, tent, light, water, else a box), since categories are free text.
- **Comments button on every row.** The board has none, but threads must stay reachable. It is still the old `CommentsButton` from `comments.tsx` (A04 restyles it).
- **My own claim.** "אתה מביא" sits at the row's end as on the board; the controls go on a second line: a stepper (minus, count, plus) where more than one can be brought, and "לוותר" with the undo icon. The board's inline undo icon did not fit next to the comments button at 375px.
- **Partial claims** list who is already bringing under the title ("נשאר 3 מתוך 4 · ניר"); covered rows show the first bringer's avatar, name, "+N" and the tick, as on the board.
- **Share, not search.** The board's search button became the share (copy) button, round, in the same slot; search was never built. Boards updated to show this and the four chips.
- **`?filter=done`** still works without a chip, because the home screen's "ציוד מכוסה" ring links to it: it shows only "כבר מכוסה" and no chip is lit.
- **Repeated cta.** "אני מביא" is drawn in the cta colour on every waiting row, as on the board (and on home), alongside "פריט חדש". If the one-cta rule should win, "אני מביא" could become the soft peach button.
- Bringer avatars are 30px as drawn, so they are no longer tappable to open the photo (a 30px target is under 44px).
- "פריט חדש" opens the bottom sheet, editors only. Viewers see no take, step, release or add controls; until `/me` answers nobody sees them, so they never flash for a viewer.
- An error loading the list shows the error state with "לנסות שוב"; an empty trip, an empty filter and an empty "אני מביא" each show an empty state.
