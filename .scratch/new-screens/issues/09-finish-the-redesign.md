# B09: Finish the redesign

**What to build:** Deletes the bridge that maps the old colour names onto the new palette, adds a check that runs with typecheck and fails on `white/NN`, `night-*`, `brand-*`, `aqua-*`, `ocean-*` or `glass` in the app's source, deletes the old flat chat feed route, and ships with a Hebrew note about the new look (no `[no-popup]`).

**Blocked by:** A03 to A15 (every Spec A screen ticket); B02 to B08

**Status:** ready-for-agent

- [ ] The chat list (B02) has been live for at least one release before the old feed route is deleted
- [ ] Typecheck fails when an old colour name is added anywhere in the app's source, and passes on the cleaned tree
- [ ] Every screen still renders correctly in light and dark with the bridge gone
- [ ] The PR title and body are the Hebrew note campers see
