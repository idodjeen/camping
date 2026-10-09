# A13: Group admin

**What to build:** The group admin page matches its board: people with roles, shoppers per trip, and trips. Adding a person by email still ends with the ready WhatsApp message; the board's invite-link card is not built, and the board gets a note that it comes with Spec C. The people field, kept-names notice and invite note move out of the super admin's file into shared components. All four browser confirms become the delete confirm pop-up.

**Blocked by:** A02: Shared design parts and states; A11: Trip settings details and the reminder card

**Status:** ready-for-agent

- [ ] Adding, promoting, demoting and removing people, and putting people on or off a trip, work as before
- [ ] No native browser confirm remains on this page
- [ ] The inline new trip form uses the shared trip form fields from A11
- [ ] The group admin board has a note that the invite link comes later
- [ ] Done per Spec A's definition of done: typecheck, build and tests pass; checked in the preview at phone width in light and dark; no old class names left on the touched screens; board updated if the screen differs from it; PR title carries `[no-popup]`; not merged by the agent
