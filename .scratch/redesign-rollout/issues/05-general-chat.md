# A05: General chat

**What to build:** The general chat matches its board, reusing the composer and tag highlighting from A04: bubbles with names and avatars, day separators, and the composer floating above the tab bar and the keyboard. The header keeps the menu button and title. No typing indicator, read ticks, activity lines, list cards or members button.

**Blocked by:** A02: Shared design parts and states; A04: Item thread

**Status:** ready-for-agent

- [ ] The composer stays visible above the keyboard and the tab bar, with no zoom and no sideways drag (as fixed in #23)
- [ ] Reading older messages is not interrupted when new ones arrive on the 15s refresh
- [ ] Editing a message (roadmap G) still works
- [ ] Done per Spec A's definition of done: typecheck, build and tests pass; checked in the preview at phone width in light and dark; no old class names left on the touched screens; board updated if the screen differs from it; PR title carries `[no-popup]`; not merged by the agent
