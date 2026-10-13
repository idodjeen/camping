# B03: Account, guide and menu

**What to build:** The account page holds the profile, roles in each group (from `loadMemberships`, read-only), the trips where the caller is shopper, the notification switches and the phone notifications switch. The menu's profile header opens it, and the "התראות" row opens it at the notification settings; the guide and logout leave the account page and stay in the menu. The guide is rebuilt to its board: four cards with no names or emoji, an extra card for group admins, shown once per person, skippable and replayable from the menu.

**Blocked by:** B01 (account and guide boards approved); A09: Trips, memberships and the trip switcher; A11: Trip settings details and the reminder card

**Status:** ready-for-agent

- [ ] A member of two groups sees both groups with the right role in each
- [ ] Viewers see their role and no notification switches
- [ ] The phone switch shows a clear state when the phone blocks notifications
- [ ] The guide shows at a fresh account's first sign-in, not again after joining a second group, and replays from the menu
- [ ] Group admins see the extra card; others do not
- [ ] Done per Spec B's definition of done: typecheck, build and tests pass; checked in the preview at phone width in light and dark; no old class names left on the touched screens; board updated if the screen differs from it; PR with a Hebrew title campers can read; not merged by the agent
