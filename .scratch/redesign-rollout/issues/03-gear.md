# A03: Gear

**What to build:** The gear screen matches its board: "מחכים למישהו" first with one-tap "אני מביא", "כבר מכוסה" below with who brings each item, and the "פריט חדש" button for editors. The chips become הכל / חסר / אני מביא / הרשימה שלי, plus תייגו אותך when there is something to find. The my-gear view is restyled; the personal list view keeps working as it is (Spec B redesigns it).

**Blocked by:** A02: Shared design parts and states

**Status:** ready-for-agent

- [ ] Taking, lowering and releasing gear work as before, including the "someone took the last one" message
- [ ] Chip labels are exactly הכל, חסר, אני מביא, הרשימה שלי, and תייגו אותך only when present
- [ ] The copy buttons still copy the full list, my gear or the personal list
- [ ] Viewers see no take or add buttons
- [ ] The gear board on the canvas is updated to show the four chips
- [ ] Done per Spec A's definition of done: typecheck, build and tests pass; checked in the preview at phone width in light and dark; no old class names left on the touched screens; board updated if the screen differs from it; PR title carries `[no-popup]`; not merged by the agent
