# B02: Chat list

**What to build:** The chat tab becomes the chat list: the general chat pinned on top, then one row per thread with at least one message, newest first, each with the item's kind, name, last message and author, time, an unread count for threads the caller follows, and a "תייגו אותך" marker. Filter chips הכל / ציוד / קניות / ארוחות / תייגו אותי filter on the client. A new server function, `listThreads(userId, tripId)`, next to the existing chat feed, backs a new trip route with read access. The old flat feed route stays until B09. Seam S1.

**Blocked by:** B01 (chat list board approved); A01: Test setup; A02: Shared design parts and states; A04: Item thread

**Status:** ready-for-agent

- [ ] Tests (written first) cover: general chat first; others newest first; threads with no message left out; a deleted last message falls back to the one before; unread counts only from the caller's own unread rows; the tag marker until read; reading clears the count; a thread from another trip of the same group never appears; a viewer gets no counts
- [ ] Tapping a row opens the thread sheet; tapping the general chat opens it
- [ ] Reading a thread clears its count in the list without waiting for the next refresh
- [ ] Each filter has an empty state
- [ ] The list's counts agree with the notifications screen for the same threads
- [ ] Done per Spec B's definition of done: typecheck, build and tests pass; checked in the preview at phone width in light and dark; no old class names left on the touched screens; board updated if the screen differs from it; PR with a Hebrew title campers can read; not merged by the agent
