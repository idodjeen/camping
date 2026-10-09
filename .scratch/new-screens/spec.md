# Spec B: New screens

**Status:** ready-for-agent
**Starts after:** Spec A's shared design parts and test setup. Board drawing can start right away.
**Words:** `GLOSSARY.md`. **Decisions:** `docs/adr/`.

## Problem Statement

Eight places in the app have no board on the design canvas, and several were written for the original
five friends. The chat tab is one long stream of item messages, so finding the conversation about the gas
stove means scrolling. The account page repeats half of the menu and holds an admin reminder card. The
guide talks about "מחנאות 2026" and the Upper Galilee. The no-access page used to say "דברו עם עידו",
which helps nobody in another group. The new trip form is squeezed inside the group admin page, and the
trip settings meals and categories tabs, the personal list and the what's-new pop-up were never designed.
After Spec A these would be the only screens still in the old look.

## Solution

Each of the eight gets a board in light and dark, drawn in one design session so they look like one set,
and approved by Ido before it is built. Then each is built to its board. Two of them also change how
things work: the chat tab becomes a **chat list** with one row per **thread**, and the **account** page
becomes your profile, roles and notification settings only, opened from the menu. The last ticket deletes
the old colour bridge and announces the new look.

## User Stories

**Chat list**

1. As a camper, I want the chat tab to list conversations, one row per thread, so that I can find the one I need without scrolling through every message.
2. As a camper, I want the general chat pinned at the top of the chat list, so that the trip-wide conversation is always one tap away.
3. As a camper, I want each row to show the item's name, its kind (gear, shopping or meal) and the last message with its author, so that I know what is happening without opening it.
4. As a camper, I want rows ordered by their newest message, so that active conversations rise to the top.
5. As a camper, I want an unread count on threads I follow, so that I know where something new was said to me.
6. As a camper, I want a "תייגו אותך" marker on rows where I was tagged and have not read it, so that I answer people who asked me directly.
7. As a camper, I want threads nobody wrote in to stay out of the list, so that the list holds only real conversations.
8. As a camper, I want filter chips for הכל, ציוד, קניות, ארוחות and תייגו אותי, so that I can narrow the list.
9. As a camper, I want an empty state when a filter has nothing, so that I know the filter works and the list is not broken.
10. As a camper, I want tapping a row to open that item's thread sheet, so that I can read and answer in place.
11. As a camper, I want reading a thread to clear its unread count in the list, so that the list matches what I have seen.
12. As a camper, I want threads from another trip never to appear, so that groups and trips stay apart.

**Account**

13. As a camper, I want to open my account from my profile at the top of the menu, so that it is where I expect it.
14. As a camper, I want the menu's "התראות" row to open my account at the notification settings, so that I can change them quickly.
15. As a camper, I want my account to show my name and Google photo, so that I know which account I am signed in with.
16. As a member of several groups, I want my account to list each group with my role in it, so that I know what I can do where.
17. As a shopper, I want my account to show the trips where I am the shopper, so that I remember my job.
18. As a camper, I want to turn each kind of notification on or off on my account, so that I hear only what matters to me.
19. As a camper, I want the phone notifications switch on my account, with a clear state when my phone blocks it, so that I can fix it myself.
20. As a viewer, I want my account to show my role without notification switches, so that I am not offered settings that do nothing for me.
21. As a camper, I want the guide and logout in the menu only, so that they are not in two places.

**Personal list**

22. As a camper, I want my personal list under the "הרשימה שלי" chip on the gear screen, so that it sits next to my gear.
23. As a camper, I want to add an item to my personal list by typing and pressing enter, so that adding is fast.
24. As a camper, I want to tick personal items as packed, so that I can pack from the list.
25. As a camper, I want a "ארזתי 5 מתוך 12" line, so that I know how close I am.
26. As a camper, I want to rename or delete a personal item, so that the list stays accurate.
27. As a camper, I want to copy my personal list as text, so that I can paste it into a note or a message.
28. As a camper, I want an empty state that says only I can see this list, so that I trust it with private items.

**Guide**

29. As a new member of any group, I want the guide at my first sign-in to describe the app without naming another group or person, so that it is about my trip.
30. As a new member, I want four short cards (trip, gear, meals and shopping, personal list) with small illustrations, so that I learn the app in under a minute.
31. As a new group admin, I want an extra card about managing the trip, so that I know where the settings are.
32. As a new member, I want to skip the guide, so that I can start straight away.
33. As a member who joins a second group, I want not to see the guide again, so that I am not slowed down.
34. As a camper, I want to replay the guide from the menu, so that I can refresh my memory.

**No-access page**

35. As someone whose email is not in any group, I want to see which email I signed in with, so that I can tell whether I used the wrong account.
36. As that person, I want to copy that email in one tap, so that I can send it to my group admin.
37. As that person, I want a main button to sign in with a different account, so that I can fix a wrong-account mistake myself.
38. As anyone, I want the page to name no group or person, so that it makes sense whichever group I belong to.
39. As anyone hitting a server setup error, I want to be told it is a fault on the app's side and to try again later, so that I do not blame myself.
40. As Ido, I want the small error code kept at the bottom, so that a screenshot alone is enough to diagnose it.
41. As a member opening an admin page I may not use, I want the same card, so that "no access" looks the same everywhere.

**New trip form**

42. As a group admin, I want a "טיול חדש" button on the trips screen, so that I can start a trip from where I see my trips.
43. As a group admin, I want the same button on the group admin page, so that both places open the same form.
44. As a member who is not admin of any group, I want no "טיול חדש" button, so that I am not offered something I cannot do.
45. As an admin of two groups, I want to pick the group first inside the form, so that the trip lands in the right group.
46. As a group admin, I want to enter the name, dates, place and map point, so that the trip is set up in one go.
47. As a group admin, I want to start from an earlier trip or the basic list, so that I do not rebuild the gear list every time.
48. As a group admin, I want a line saying what will be copied, so that I know whether meals come along.
49. As a group admin, I want to land on the new trip's home after creating it, so that I can share it right away.

**Trip settings: meals and categories tabs**

50. As a group admin, I want the meals and categories tabs to look like the details tab, so that trip settings feel like one screen.
51. As a group admin, I want to add and edit a meal in the new meal pop-up, and delete it, so that the plan is right.
52. As a group admin, I want to add, rename and delete gear and shopping categories, so that the lists stay organised.
53. As a group admin, I want deleting to ask first with the delete confirm pop-up and say what goes with it, so that I do not lose items by mistake.

**What's new pop-up**

54. As a camper, I want the what's-new window to match the app, with a small illustration and one main button, so that updates feel cared for.
55. As a camper, I want to see it once per update on each device, so that it does not nag.
56. As a camper with an old version open, I want "הבנתי" to reload into the new version, so that I am never stuck on old code.
57. As a camper, I want no window for quiet updates, so that small fixes do not interrupt me.

**Finishing the redesign**

58. As a developer, I want the old colour names deleted once no screen uses them, so that new code cannot slip back into the old look.
59. As a developer, I want typecheck to fail if an old colour name comes back, so that the rule enforces itself.
60. As a camper, I want one note telling me the app has a new look, so that the change feels intentional.
61. As Ido, I want one real-phone checklist at the end, so that the new screens are checked on a phone in one sitting.

## Implementation Decisions

**Boards first.** One design session draws all eight boards, light and dark, on the design canvas, using
the design system and the existing boards' parts: chat list, account, personal list (gear screen with the
"הרשימה שלי" chip selected), guide (cards plus the admin card), no-access (both versions), new trip
sheet (with the group picker), trip settings meals tab and categories tab, and the what's-new sheet. Ido
approves each on the canvas. Each build ticket is blocked by its own board.

**Build order:** chat list first; then account together with the guide (they share the menu changes);
then personal list, new trip form, meals and categories tabs, no-access and what's new, which can run side
by side. Every build ticket also depends on Spec A's shared parts.

**Chat list.**
- A new server function, `listThreads(userId, tripId)`, sits in the comments module next to the existing
  chat feed. It returns one summary per thread that has at least one message: the subject (general, gear,
  shopping or meal) and item, the item's name, the last message's author, text and time, the caller's
  unread count for that thread, and whether the caller has an unread tag in it. The general chat comes
  first, the rest newest first.
- Unread counts and tags come only from the caller's own unread notification rows for that thread. There
  is no new read-state table and no migration. Threads the caller does not follow show the last message
  and time with no count.
- A new trip route returns this list behind the trip gate, read access. The filter chips filter on the
  client.
- The old flat chat feed route stays for one release after the chat list ships, then is deleted in the
  final ticket of this spec.

**Account.**
- Shows profile, roles and notification settings only. The roles come from Spec A's `loadMemberships`:
  each group and role, plus the trips where the caller is shopper. Roles are read-only here.
- The menu's profile header opens the account page; the menu's "התראות" row opens it at the notification
  settings. The guide and logout leave the account page and stay in the menu, as on the menu board.
- Viewers see their role and no notification switches, as today.

**Personal list.** Same behaviour as today (add, tick as packed, rename, delete, copy), plus a packed
progress line and an empty state, in the gear screen under the "הרשימה שלי" chip that Spec A introduces.

**Guide.** Four cards with no emoji and no names: trip, gear, meals and shopping, personal list, each with
a small illustration in the style of the sign-in scene. Group admins get a fifth card about trip settings.
Shown once per person (the existing "onboarded" flag), skippable, replayable from the menu. The menu row
keeps its label "המדריך הקצר".

**No-access page.** Generic wording from groups phase 7, the signed-in email with a copy button, and a
main "התחברות עם חשבון אחר" button. A second version for the server setup error. The small error code
stays. The same card replaces the "אין הרשאה" state on the super admin and group admin pages.

**New trip form.** One sheet replaces the inline form in the group admin page. Same fields and same create
call as today. It opens from "טיול חדש" on the trips screen (shown only to admins of at least one group)
and on the group admin page (with that group chosen). Admins of more than one group pick the group first,
from `loadMemberships`.

**Meals and categories tabs.** Same behaviour as the current trip settings tabs, drawn to match the
details tab. Adding and editing a meal uses the new meal pop-up from its board (moved here from Spec A,
since meals are only added in trip settings). Deletes go through the delete confirm pop-up.

**What's new.** Same behaviour as today: the live deploy's title and body, once per device, nothing for
quiet deploys, reload on "הבנתי" when the open version is old. New look only.

**Final ticket: finish the redesign.** Blocked by every Spec A and Spec B screen ticket. Deletes the
bridge from the old colour names to the new palette; adds a check that runs with typecheck and fails on
`white/NN`, `night-*`, `brand-*`, `aqua-*`, `ocean-*` or `glass` anywhere in the app's source; deletes the
old flat chat feed route; and ships without `[no-popup]`, with a Hebrew note about the new look.

**Definition of done** is the same as Spec A's, except that build tickets in this spec ship with a normal
Hebrew PR title, so campers get a pop-up for each new screen.

## Testing Decisions

- A good test calls a lib function with plain ids against a database the test seeds, and checks what comes
  back, not how the query is built.
- **`listThreads` (seam S1)** is tested first, test-first: the general chat is first; other threads are
  newest first; a thread with no messages is left out; a deleted last message falls back to the one before
  it; unread counts count only the caller's own unread rows for that thread; a tag shows the marker until
  read; reading a thread clears its count; a thread from another trip of the same group never appears;
  a viewer gets the list with no counts.
- **`loadMemberships` (seam S2)** already has tests from Spec A. Account and the new trip form add cases
  only if they need a field it does not return.
- **No tests for** the guide, no-access, what's new, the personal list, the trip settings tabs or the new
  trip sheet's screen: their server code does not change. Each PR lists what was checked in the preview in
  light and dark.
- **Prior art:** Spec A's memberships tests and its test setup.

**Real-phone checklist (end of this spec):**
- Chat list: a new message in a followed thread raises its count within one refresh, and opening the
  thread clears it.
- Account: the phone notifications switch on an installed app, including when the phone blocks it.
- Guide: shown at first sign-in of a fresh test account, skippable, replayable.
- New trip sheet: the date fields and the group picker with the keyboard open.
- No-access: sign in with an email that is in no group, copy the email, switch account.
- What's new: shown once after a deploy, not after a `[no-popup]` deploy.

## Out of Scope

- **Self-serve groups (Spec C):** the "new group or join" board, invite links and codes, open sign-in.
  The no-access page keeps its current meaning until then.
- **Chat extras:** activity lines, list cards in messages, typing indicator, read ticks.
- **A per-person read marker for every thread**, so that unfollowed threads also show counts.
- **Changing roles from the account page.** That stays on the group admin page.
- **Trips without dates.**
- **Returning a real 403 status** from the admin pages; only their card changes here.

## Further Notes

- The guide's text and illustrations should be reviewed by Ido in the board step, since it is the first
  thing new groups see.
- When the chat list ships, the notifications screen and the chat list both show per-thread unread counts
  from the same rows, so they must always agree.
