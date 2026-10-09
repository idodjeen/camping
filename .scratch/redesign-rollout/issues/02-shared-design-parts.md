# A02: Shared design parts and states

**What to build:** The building blocks every redesigned screen is made of, matching the design system and the states boards: main button, secondary button, chip and chip row, segmented control, text field with label and hint, switch, checkbox, grouped list row (icon tile, title, trailing value, chevron), card, sheet, badge, empty state, error state, skeletons, toast and banner, and the delete confirm pop-up from its board. The existing modal, side sheet, filter chips, skeletons, toast and error card are reworked into these rather than duplicated, so every place that already uses them changes look at once. Screens' own inline markup is left to their tickets.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Every part uses only the design tokens' names and logical properties, and works in light and dark
- [ ] Text is never below 13px, touch targets are at least 44px, titles and numbers use the display font
- [ ] The delete confirm pop-up names what will be deleted and has a clearly destructive button; it is ready to replace the browser's native confirm
- [ ] The checkbox is a shared part, no longer owned by the personal list
- [ ] Toasts, skeletons, the error card, the modal, the side sheet and the filter chips render in the new look wherever they are used today
- [ ] The viewer banner matches the states board
- [ ] Done per Spec A's definition of done: typecheck, build and tests pass; checked in the preview at phone width in light and dark; no old class names left on the touched screens; board updated if the screen differs from it; PR title carries `[no-popup]`; not merged by the agent
