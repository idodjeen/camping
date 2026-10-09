# B08: What's new

**What to build:** The what's-new pop-up matches its board: a sheet with a small illustration, the deploy's title and body, and one main button. Behaviour stays: once per device per deploy, nothing for quiet deploys, and "הבנתי" reloads when the open version is old.

**Blocked by:** B01 (what's-new board approved); A02: Shared design parts and states

**Status:** ready-for-agent

- [ ] Shown once after a normal deploy and never after a `[no-popup]` one
- [ ] A tab with an old version reloads after "הבנתי"
- [ ] Done per Spec B's definition of done: typecheck, build and tests pass; checked in the preview at phone width in light and dark; no old class names left on the touched screens; board updated if the screen differs from it; PR with a Hebrew title campers can read; not merged by the agent
