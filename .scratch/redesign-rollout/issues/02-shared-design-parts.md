# A02: Shared design parts and states

**What to build:** The building blocks every redesigned screen is made of, matching the design system and the states boards: main button, secondary button, chip and chip row, segmented control, text field with label and hint, switch, checkbox, grouped list row (icon tile, title, trailing value, chevron), card, sheet, badge, empty state, error state, skeletons, toast and banner, and the delete confirm pop-up from its board. The existing modal, side sheet, filter chips, skeletons, toast and error card are reworked into these rather than duplicated, so every place that already uses them changes look at once. Screens' own inline markup is left to their tickets.

**Blocked by:** None (can start immediately)

**Status:** done 2026-10-24

- [x] Every part uses only the design tokens' names and logical properties, and works in light and dark
- [x] Text is never below 13px, touch targets are at least 44px, titles and numbers use the display font
- [x] The delete confirm pop-up names what will be deleted and has a clearly destructive button; it is ready to replace the browser's native confirm
- [x] The checkbox is a shared part, no longer owned by the personal list
- [x] Toasts, skeletons, the error card, the modal, the side sheet and the filter chips render in the new look wherever they are used today
- [x] The viewer banner matches the states board
- [x] Done per Spec A's definition of done: typecheck, build and tests pass; checked in the preview at phone width in light and dark; no old class names left on the touched screens; board updated if the screen differs from it; PR title carries `[no-popup]`; not merged by the agent

## Comments

- 2026-10-24: the parts live in `components/ui/` (button, controls, surfaces, confirm, tone). Three things
  differ from the boards, on purpose:
  - **A `scrim` token** (aubergine 38% light, black 55% dark) dims the page behind sheets and dialogs. The
    old dim was `ink` at 30-40%, and in dark `ink` is the light cream, so it lightened the page instead.
    The side sheet from #25 had the same bug and uses it now.
  - **The ok-toast tick is canvas on the strong green**, not ink: ink there is about 2.4:1 in light and
    light-on-light in dark.
  - **The modal is now the bottom sheet** from the pop-up boards (handle, drag down to close), so every
    pop-up in the app changes shape at once.
- `confirmAction({ title, body, action })` replaces the browser's confirm(); it needs `<ConfirmHost />`,
  mounted next to every `<Toaster />`.
- `/dev/ui` shows every part in light and dark, for checking screens as they are built. Development only:
  production prerenders it as a 404 and the sign-in gate covers it too.
