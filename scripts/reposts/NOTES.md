# Reposts — known issues and notes

Read this before trusting the reposts scripts. Reposts behave differently from
likes / comments / story replies in two ways, one on Instagram's side and one
that was our own doing.

## Recommended: un-repost via the profile viewer (`4-unrepost-via-viewer.js`)

The bulk-list scripts (`1`-`3`) are unreliable (see section 1). The viewer flow
is the one that actually works, so prefer it.

Instead of the "Your activity > Reposts" bulk list, open your profile Reposts
tab and go through the posts in the normal viewer:

1. Open `instagram.com/<your_username>/reposts`.
2. Click the first repost to open it in the viewer (with the Next arrow).
3. Run `4-unrepost-via-viewer.js`.

How un-repost works there: clicking the repost icon opens a small popover that
says **"You reposted this. Delete"** (plus an "Add" emoji button). Clicking
**Delete** un-reposts. The script clicks the repost icon, clicks that Delete
link, then clicks Next, and repeats.

Two things make it safe:

- The **"You reposted this"** text only shows when the post is actually
  reposted. The script only clicks Delete when that popover is present, so it
  can never accidentally re-repost. It never touches "Add".
- If the popover/Delete is missing, it stops instead of guessing.

Note: the repost icon uses `aria-label="Repost"` in both states and the only
visual difference is the SVG path shape, so you cannot tell reposted from
not-reposted by aria-label alone. The popover text is the reliable signal.

Still start with a small `MAX` and go slow — reposts rate-limit easily.

## 1. Partial deletion (not always reproducible)

On one account we saw this: select ~30 reposts, confirm, and only a few
actually disappear (sometimes with a "deleted" toast for the rest). On a
different account the exact same flow worked fine with no partial deletion.

So this is **not a guaranteed Instagram bug** — it is account/session specific.
Most likely causes, in rough order:

- **Rate limiting.** Heavy activity in a short window (lots of deletes/tests the
  same day) makes Instagram silently throttle, so only part of a batch goes
  through. A fresh session on a "cold" account (e.g. a different person's) does
  not hit this.
- **Large batch + virtualized list.** The list only keeps visible rows in the
  DOM and recycles them on scroll. With a big selection (say 30) some selected
  rows scroll out and their selection goes stale, so only the on-screen ones
  delete.

What helps:

- Use a **small BATCH** (5–6) so the whole selection stays on screen.
- Go slower / spread deletes over time instead of hammering in one session.
- Sorting **Oldest to newest** (Sort & filter) can keep rows more stable.
- The bulk script counts the actually-selected icons (`circle-check`) before
  deleting, so it won't report fake successes.

If only part of a batch deletes, it is usually rate limiting — stop and try
again later.

## 2. We over-engineered the reposts scripts

The reposts scripts carry extra complexity that later turned out to be
unnecessary — the same simple flow used by the comments and story-replies
scripts works here too.

What we did and why it was wrong:

- We concluded the confirm was a bare React `div` that needed a leaf-level
  click plus a full `pointer`+`mouse` event sequence. That came from bad
  diagnostics, not a real difference.
- Our click recorder checked `closest('[role="button"]')`. The confirm is a
  real `<button>` element, which has an *implicit* button role and no
  `role="button"` **attribute**, so the recorder reported `button-ancestor:
  none`. We wrongly read that as "there is no button here".
- An early probe ran while the confirm popup was closed, so it saw no buttons
  and reinforced the wrong conclusion.
- Not reloading between runs left stale dialogs/selections, so the popup opened
  on some runs and not others. We "fixed" symptoms (leaf click, pointer events,
  polling) that were not the real problem. When it finally worked it was most
  likely the fresh reload, not the pointer events.

Reality: reposts use the same Bloks flow as comments —
`TextSpan "Delete"` → click the `pointer-events: auto` container → confirm via
a real `<button>` whose text is "Delete".

TODO: simplify `3-bulk-remove-reposts.js` and `2-mini-test-3-reposts.js` to the
comments-style approach and drop the pointer-event / leaf-click code. Keep the
"Oldest to newest" note above, since the partial-deletion bug is a separate,
real Instagram issue.
