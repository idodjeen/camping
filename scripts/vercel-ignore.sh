#!/usr/bin/env bash
# Vercel's "Ignored Build Step", wired up in vercel.json (ignoreCommand).
# Exit 0 skips the build, exit 1 runs it. Whenever in doubt, it builds.
#
# Only production is ever skipped, and only when a commit changes nothing the
# live app is built from. A production build replaces the live deployment:
# every server function starts cold, and every open tab reloads on its next
# tap (deploymentId in next.config.ts). Docs, tickets and agent notes don't
# need any of that. Previews always build.
#
# Try it locally against two commits:
#   VERCEL_ENV=production VERCEL_GIT_PREVIOUS_SHA=<old> VERCEL_GIT_COMMIT_SHA=<new> bash scripts/vercel-ignore.sh

set -u

# What a deployment is built from. Everything else (docs/, .scratch/, *.md,
# .claude/, drizzle/ and the db scripts) never reaches the running app.
APP_PATHS=(
  src
  public
  package.json
  package-lock.json
  next.config.ts
  tsconfig.json
  postcss.config.mjs
  vercel.json
)

if [ "${VERCEL_ENV:-}" != "production" ]; then
  echo "vercel-ignore: ${VERCEL_ENV:-unknown} deployment, building"
  exit 1
fi

# Compared with the commit that is live now, not with the previous commit, so
# an earlier commit that never got built can't hide behind a docs-only one.
# Vercel only sets VERCEL_GIT_PREVIOUS_SHA for this step.
HEAD_SHA="${VERCEL_GIT_COMMIT_SHA:-HEAD}"
BASE_SHA="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$BASE_SHA" ] || ! git cat-file -e "${BASE_SHA}^{commit}" 2>/dev/null; then
  echo "vercel-ignore: no live commit to compare with, building"
  exit 1
fi

# --quiet exits 0 for no difference, 1 for a difference and 128 on any git
# error, so only a clean "nothing changed" skips.
git diff --quiet "$BASE_SHA" "$HEAD_SHA" -- "${APP_PATHS[@]}"
case $? in
  0)
    echo "vercel-ignore: nothing the app is built from changed since ${BASE_SHA:0:7}, skipping"
    exit 0
    ;;
  1)
    echo "vercel-ignore: app files changed since ${BASE_SHA:0:7}, building"
    exit 1
    ;;
  *)
    echo "vercel-ignore: could not compare with ${BASE_SHA:0:7}, building"
    exit 1
    ;;
esac
