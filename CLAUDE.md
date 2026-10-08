@AGENTS.md

## Design system

The app's look is the "מחנאות" design system: https://claude.ai/artifact/Dcwx8PA5eVgdJfbExZSup3
(tokens, type, components and the rules behind them). The screen designs, light and dark,
are on the design canvas: https://claude.ai/artifact/NBVdF6UYVvbs5r3SWfyGSs

The tokens live in code in `src/app/globals.css`; the design system mirrors them. Every UI change follows these rules:

- Colours by their names only: `bg-canvas`, `bg-surface`, `border-line`, `text-ink`, `text-muted`,
  accent pairs (`bg-peach text-peach-ink`, rose, sage, amber, coral), `bg-cta text-on-cta`, `text-link`.
  Never `white/NN`, `night-*`, `brand-*`, `aqua-*`, `ocean-*` or `glass` in new code: they are a
  temporary bridge for screens not redesigned yet. Remove them from a screen when you touch it.
- Check every change in both themes (`data-theme="light"` and `"dark"` on `<html>`).
- One primary (`bg-cta`) action per screen; everything else is secondary.
- Text never smaller than 13px. Touch targets at least 44px. Titles and numbers in `font-display`.
- Right to left: logical properties only (start/end, ms/me, ps/pe), never left/right.
  Numbers, dates and money in `dir="ltr"` spans.
- No emoji in the interface, and no copy that names one specific group or person.
- States: skeletons for loading, an empty state with one action, errors that say what to do.
- When a screen changes, update its board on the design canvas, and the design system when a
  token or component changes.
