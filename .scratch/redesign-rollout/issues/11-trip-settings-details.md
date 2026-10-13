# A11: Trip settings details and the reminder card

**What to build:** The trip settings details tab matches its board: name, dates with the "להזיז גם את הארוחות" switch when the dates change, place and map point. The trip form fields move into their own shared component, since the group admin page and Spec B's new trip sheet reuse them. The email reminder card moves here from the account page, shown to the super admin only.

**Blocked by:** A02: Shared design parts and states

**Status:** ready-for-agent

- [ ] Saving details, and moving meals with the dates, work as before
- [ ] The trip form fields are one shared component used by both this tab and the group admin page's new trip form
- [ ] The reminder card is on this tab for the super admin, hidden for everyone else, and gone from the account page
- [ ] Reminders still go to the right audience (everyone or the shoppers) for this trip
- [ ] The meals and categories tabs keep working as they are (Spec B redesigns them)
- [ ] Done per Spec A's definition of done: typecheck, build and tests pass; checked in the preview at phone width in light and dark; no old class names left on the touched screens; board updated if the screen differs from it; PR title carries `[no-popup]`; not merged by the agent
