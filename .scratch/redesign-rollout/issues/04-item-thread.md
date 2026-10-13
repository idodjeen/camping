# A04: Item thread

**What to build:** The thread sheet for a gear, shopping or meal item matches its board: the item with what is still missing and its category on top, messages grouped by day, own messages on one side in the user's colour, tags (including @כולם) highlighted, and the composer with tagging. The composer and tag highlighting are shared with the general chat, so they are restyled here once.

**Blocked by:** A02: Shared design parts and states

**Status:** ready-for-agent

- [ ] Posting, tagging, @כולם, deleting and the "נשלח מייל ל…" toast work as before
- [ ] Editing a message (roadmap G) still works, and edited messages still show "(נערך)"
- [ ] The tagged badge used elsewhere (bell, lists) is in the new look
- [ ] Opening the sheet from gear, shopping, meals, the chat tab and the bell all work
- [ ] Done per Spec A's definition of done: typecheck, build and tests pass; checked in the preview at phone width in light and dark; no old class names left on the touched screens; board updated if the screen differs from it; PR title carries `[no-popup]`; not merged by the agent
