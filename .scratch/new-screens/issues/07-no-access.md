# B07: No-access

**What to build:** The no-access page matches its board: generic wording with no group or person, the signed-in email with a copy button, and a main "התחברות עם חשבון אחר" button. A second version for the server setup error says it is the app's fault and to try again later. The small error code stays. The same card replaces the "אין הרשאה" state in the super admin page, the group admin page and trip settings.

**Blocked by:** B01 (no-access board approved); A11: Trip settings details and the reminder card; A13: Group admin; A15: Super admin; B06: Trip settings meals and categories tabs

**Status:** ready-for-agent

- [ ] Signing in with an email in no group shows that email and the switch-account button
- [ ] The setup-error version shows when sign-in is misconfigured
- [ ] The three in-app "אין הרשאה" states use the same card
- [ ] Done per Spec B's definition of done: typecheck, build and tests pass; checked in the preview at phone width in light and dark; no old class names left on the touched screens; board updated if the screen differs from it; PR with a Hebrew title campers can read; not merged by the agent
