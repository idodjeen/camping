# A04: Item thread

**What to build:** The thread sheet for a gear, shopping or meal item matches its board: the item with what is still missing and its category on top, messages grouped by day, own messages on one side in the user's colour, tags (including @כולם) highlighted, and the composer with tagging. The composer and tag highlighting are shared with the general chat, so they are restyled here once.

**Blocked by:** A02: Shared design parts and states

**Status:** done 2026-10-24

- [x] Posting, tagging, @כולם, deleting and the "נשלח מייל ל…" toast work as before
- [x] Editing a message (roadmap G) still works, and edited messages still show "(נערך)"
- [x] The tagged badge used elsewhere (bell, lists) is in the new look
- [x] Opening the sheet from gear, shopping, meals, the chat tab and the bell all work
- [x] Done per Spec A's definition of done: typecheck, build and tests pass; checked in the preview at phone width in light and dark; no old class names left on the touched screens; board updated if the screen differs from it; PR title carries `[no-popup]`; not merged by the agent

## Comments

- 2026-10-24: the sheet is `CommentsSheet` in `components/comments.tsx`, on A02's bottom sheet, built on
  roadmap G (#31). What differs from the board, and the board was updated to match (Thread, ThreadDark):
  - **Sheet header, not a screen header.** It is a bottom sheet (A02), so it has the handle, "תגובות" over
    the item's name, and the close button, instead of a back button and a centred title.
  - **Own messages** sit on the end side in peach (the "me" accent, as on the chat board), with the time,
    "(נערך)", the pencil (G) and the bin. Others' bubbles have the small corner next to the avatar.
  - **"נשלח מייל ל…"** is the amber note under the author's own message, for that visit, in place of the
    toast. Only the author ever saw it, as before.
  - **Times are 13px** (the board had 12px, under the 13px floor) and read left to right.
  - **The item card** also covers shopping (bought or not, quantity, category, who bought it) and meals
    (ingredients still to buy, day and slot). The API's thread read gained an `item` field for it.
  - **Delete asks first** with A02's confirm pop-up; it used to delete on one tap.
  - **Viewers** get the "צפייה בלבד" note instead of a composer the API would refuse.
