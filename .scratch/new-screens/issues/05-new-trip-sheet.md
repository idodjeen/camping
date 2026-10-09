# B05: New trip sheet

**What to build:** One sheet replaces the inline new trip form. It opens from "טיול חדש" on the trips screen (shown only to admins of at least one group) and on the group admin page (with that group chosen). Admins of more than one group pick the group first. Same fields and the same create call as today, a line saying what will be copied, and landing on the new trip's home.

**Blocked by:** B01 (new trip sheet board approved); A09: Trips, memberships and the trip switcher; A13: Group admin

**Status:** ready-for-agent

- [ ] The group picker lists exactly the groups where the caller is admin (from `loadMemberships`)
- [ ] Starting from an earlier trip and from the basic list both work, with the right "what is copied" line
- [ ] Members who are admin of no group see no "טיול חדש" button
- [ ] The inline form is gone from the group admin page
- [ ] Done per Spec B's definition of done: typecheck, build and tests pass; checked in the preview at phone width in light and dark; no old class names left on the touched screens; board updated if the screen differs from it; PR with a Hebrew title campers can read; not merged by the agent
