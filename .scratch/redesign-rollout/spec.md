# Spec A: Redesign rollout

**Status:** ready-for-agent
**Starts after:** PR #25 (design system, light and dark, new home), groups phase 7 and roadmap F, G and H
are merged.
**Followed by:** Spec B, `.scratch/new-screens/spec.md`.
**Words:** `GLOSSARY.md`. **Decisions:** `docs/adr/`.

## Problem Statement

After PR #25 only the home screen, the header, the menu and the tab bar use the new warm design. Every
other screen still has its old markup and reaches the new palette only through a temporary bridge that
maps the old colour names onto the new ones. The app looks like two apps: rounded warm cards on home,
glass panels, gradients, emoji and 11px text one tap away. Light mode makes the gap worse, because the old
screens were drawn for a dark background. People notice the seams before they notice the features.

## Solution

Every screen that already has a board on the design canvas is rebuilt to match its board, in light and
dark, from one set of shared design parts. The rollout changes the look, not what the screens do: anything
a board shows that the app does not do yet is either left out or listed under Out of Scope. Each screen
ships on its own without a pop-up, so campers see the app improve screen by screen without being
interrupted. The temporary colour bridge is deleted at the very end, after Spec B, when no screen uses it
any more.

## User Stories

**Everyone on a trip**

1. As a camper, I want every screen to look like the home screen, so that the app feels like one product.
2. As a camper, I want to pick light, dark or "follow the device" once and have every screen follow it, so that no screen flashes the wrong colours.
3. As a camper, I want text no smaller than 13px everywhere, so that I can read the app outdoors on a phone.
4. As a camper, I want every button and row to be at least 44px tall, so that I can tap it with a cold or wet thumb.
5. As a camper, I want one clear main action per screen, so that I know what the screen is for.
6. As a camper, I want loading screens to show grey shapes in the layout of what is coming, so that the page does not jump when it loads.
7. As a camper, I want an empty screen to tell me why it is empty and offer one thing to do, so that I am never stuck.
8. As a camper, I want an error to say what went wrong and what to try, so that I can recover without asking anyone.
9. As a camper, I want numbers, dates and money to read left to right inside Hebrew text, so that "1.10 - 3.10" and "245 ₪" never come out scrambled.
10. As a camper, I want no emoji in the interface, so that the app looks the same on every phone.

**Gear**

11. As a camper, I want the gear screen to show "מחכים למישהו" first and "כבר מכוסה" below it, so that I see what is still missing.
12. As a camper, I want to tap "אני מביא" on a missing item right from the list, so that taking something is one tap.
13. As a camper, I want to see who brings each covered item as avatars, so that I know whom to ask.
14. As a camper, I want chips for הכל, חסר, אני מביא and הרשימה שלי, so that I can switch between all gear, what is missing, my gear and my personal list.
15. As a camper who was tagged on an item, I want a "תייגו אותך" chip when there is something to find, so that I can jump straight to it.
16. As a camper, I want to be told kindly when someone took the last one before me, so that I understand why my tap did not work.
17. As an editor, I want a "פריט חדש" button on the gear screen, so that I can add something we forgot.

**Threads and the general chat**

18. As a camper, I want an item's thread to show the item, how much is still missing and its category at the top, so that I know what the conversation is about.
19. As a camper, I want my own messages on one side in my colour and others' on the other side with their name and avatar, so that I can follow who said what.
20. As a camper, I want messages grouped under "היום", "אתמול" and dates, so that I can see when things were said.
21. As a camper, I want tags (including @כולם) to stand out in a message, so that I notice when I am called.
22. As a camper, I want the "נשלח מייל ל…" note after I tag someone, so that I know they will hear about it.
23. As a camper, I want the general chat composer to float above the tab bar and stay above the keyboard, so that I can always see what I type.
24. As a camper, I want the general chat to keep my place when new messages arrive while I read older ones, so that I am not yanked to the bottom.

**Shopping, meals and expenses**

25. As a camper, I want the shopping list grouped by category with what is left on top, so that I can shop quickly in the store.
26. As a shopper, I want to tick items as bought in one tap, so that everyone sees the list shrink.
27. As a camper who is not a shopper, I want to see what is bought without being able to tick it, so that the list stays reliable.
28. As a camper, I want each meal shown by day and slot with its ingredients, so that I know what we eat and what it needs.
29. As a camper, I want each meal's ingredients to link to their shopping items, so that I can see what is already bought.
30. As a camper, I want the expenses screen to show what I owe or am owed first, so that settling up is obvious.
31. As a camper, I want the expense chart and categories in the new palette in both themes, so that the chart stays readable in light mode.
32. As an editor, I want the new expense pop-up to match its board, so that adding an expense is quick.

**Trips, notifications and the leaderboard**

33. As a member of several groups, I want my trips grouped by group, so that family trips and friends' trips do not mix.
34. As a camper, I want my trips split into "עכשיו", "בתכנון" and "היינו שם", so that the trip that matters now is on top.
35. As a camper, I want the trip switcher pop-up to match its board, so that switching trips feels like the rest of the app.
36. As a camper, I want the notifications screen to keep one row per conversation, in the new look, so that the bell stays easy to scan.
37. As a camper, I want the leaderboard podium and list in the new look, so that the friendly competition still feels fun.

**Sign-in and admin screens**

38. As a new camper, I want the sign-in screen to show what the app is for and one Google button, so that signing in is obvious.
39. As someone added to a group by email, I want the sign-in screen to tell me I join automatically, so that I am not worried about a missing invite.
40. As a group admin, I want the group admin screen in the new look, with people, roles, shoppers and trips, so that managing the group is pleasant.
41. As a group admin, I want adding a person by email to end with a ready WhatsApp message, as it does today, so that inviting people still takes one paste.
42. As a group admin, I want the trip settings details tab in the new look, with the "להזיז גם את הארוחות" switch when dates change, so that changing dates keeps the meals in step.
43. As the super admin, I want the email reminder card on the trip settings details tab, so that reminders are sent from the trip they belong to.
44. As a group admin who is not the super admin, I want the reminder card hidden, so that I am not offered something I cannot do.
45. As the super admin, I want the groups screen in the new look, so that creating groups matches the rest of the app.
46. As a camper, I want the delete confirmation pop-up to name what will be deleted and make the destructive button clearly different, so that I do not delete by mistake.

**Viewers**

47. As a viewer, I want the amber "צפייה בלבד" banner on every screen, so that I understand why I cannot edit.
48. As a viewer, I want buttons I cannot use to be hidden rather than failing, so that the app never looks broken to me.

**People building it**

49. As a developer, I want one set of shared design parts, so that each screen ticket is mostly composition.
50. As a developer, I want each screen ticket to remove its screen's old class names, so that the bridge can be deleted at the end.
51. As a developer, I want a test setup that runs against a private in-process database, so that tests never touch the shared `dev` database.
52. As a developer, I want the trips screen's membership and phase logic in one tested function, so that Spec B's account page and new trip form reuse it.
53. As Ido, I want each rollout PR to merge without a pop-up, so that campers are not shown a dozen "what's new" windows.
54. As Ido, I want one real-phone checklist at the end of the rollout, so that I check the notch, the keyboard and the theme once, in one sitting.

## Implementation Decisions

**Shared design parts come first.** One ticket builds them, every screen ticket depends on it: main
button, secondary button, chip and chip row, segmented control, text field with label and hint, switch,
grouped list row (icon tile, title, trailing value, chevron), card, sheet, badge, empty state, error state
and skeletons, and the toast and banner styles from the states boards. Existing modal, side sheet, filter
chips and skeleton components are reworked into these rather than duplicated. Parts use only the design
tokens' names, logical properties, and the type scale (Assistant for text, Varela Round for titles and
numbers).

**Test setup is its own ticket**, per ADR 0001: Vitest, PGlite plugged in through the existing global
database switch, the real migrations applied, a fresh database per test file.

**Look only.** A screen ticket changes markup and styles. Its data calls, permissions and behaviour stay
as they are, except where this spec says otherwise. Things a board shows that the app lacks are not built
(see Out of Scope).

**Exceptions to look only, all agreed:**
- **Gear chips** become הכל / חסר / אני מביא / הרשימה שלי, plus תייגו אותך when present. The gear board is
  updated to show four chips. "ציוד אישי" and "מה אני מביא" are retired as labels.
- **Trips screen** groups trips by group and splits them into עכשיו / בתכנון / היינו שם. Both come from a
  new memberships module (below).
- **Email reminders** move from the account page to the trip settings details tab, still super admin only.
  The account page loses the card in the same ticket.

**Memberships module.** A new server function, `loadMemberships(userId)`, returns the caller's groups
with their role in each, each group's trips with a phase (now, planning or past, computed from the trip's
dates in Israel time) and whether the caller is a shopper on each trip. The trips screen's server-side
loading moves into it. Spec B's account page and new trip form reuse it.

**Rollout order** (after shared parts): gear, item thread, general chat, shopping, meals, expenses with
its new expense pop-up, trips with the trip switcher pop-up, notifications, trip settings details tab,
sign-in, group admin, leaderboard, super admin. The delete confirm pop-up is one of the shared parts and
replaces the browser's native confirm on each screen that has one. The new meal pop-up belongs to the
trip settings meals tab (Spec B), because meals are only added there. Up to three tickets in flight at
once, each in its own worktree. None has a migration.

**Shared code that lives in another screen's file moves out once**, in the first ticket that touches it:
the trip form fields (trip settings details), the people field, kept-names notice and invite note (group
admin), and the checkbox (shared parts). This keeps parallel tickets out of each other's files.

**General chat header** keeps the menu button and title. No members button, typing indicator, read ticks,
activity lines or list cards.

**Group admin** keeps add-by-email and the WhatsApp message. The board's invite-link card is not built;
the board gets a note that the link comes with Spec C.

**Pop-ups.** Every rollout PR title carries `[no-popup]`. The one note about the new look ships with the
bridge removal at the end of Spec B.

**Bridge removal is not in this spec.** Spec B's screens still use the old class names, so deleting the
bridge, adding the guard against old class names, and the "new look" note are Spec B's last ticket.

**Definition of done for every ticket:** typecheck, build and the ticket's tests pass; checked in the
preview at phone width in both themes; no old class names left on the screens it touched; the board
updated if the screen ended up different from it; a PR with `[no-popup]`, not merged by the agent; the ticket's `Status:` line set to `done` and its row in `docs/roadmap-redesign.md` updated in the same PR.

## Testing Decisions

- A good test calls a lib function the way a route does, with plain ids, against a database seeded by
  the test, and checks what comes back. It does not check how the function builds its query.
- **Test setup (seam S0)** is proven by its first real test.
- **Memberships (seam S2)** is tested: a trip's phase on its first day, its last day and the day after,
  using Israel time; a member who is viewer in one group and admin in another; the super admin; a group
  with no trips; shopper flags per trip; and that a group the caller is not in never appears.
- **Screens are not unit tested.** Each PR lists what was checked in the preview in light and dark.
- **Prior art:** none in tests yet. The closest pattern is the script that swaps the global database for a
  rolled-back transaction to run real code safely.

**Real-phone checklist (end of this spec):**
- Header clears the notch; banners and toasts sit below the status bar; the side sheet swipes closed.
- Light, dark and "follow the device" each hold after closing and reopening the installed app, and the
  status bar colour matches.
- General chat composer stays above the keyboard and the tab bar.
- Gear "אני מביא" and shopping ticks work one-handed.
- From roadmap E, still unchecked on a phone: one notification per thread that updates in place, the
  2-minute renotify rule, closing the notification when its thread is read, the app-icon badge, "mark all".

## Out of Scope

- **Self-serve groups (Spec C):** the "new group or join" board, invite links and invite codes, open
  sign-in.
- **Chat extras:** typing indicator, read ticks, activity lines in the chat, list cards inside messages,
  the members button.
- **Trips without dates**, which would need a migration and changes to the countdown and meals.
- **The home screen, header, menu and tab bar**, already done in PR #25. Menu changes for the account page
  are in Spec B.
- **The 8 screens without boards** (Spec B).
- **Returning a real 403 status** from the admin pages' "אין הרשאה" state.

## Further Notes

- `CLAUDE.md` (from PR #25) holds the design rules every ticket follows, with links to the design system
  and the canvas.
- When a ticket finds that a board is wrong or impossible, it changes the board too, rather than letting
  code and board drift.
- The parallel-work rules in `docs/handoff.md` apply: own branch, own worktree, check the overlap before
  merging second.
