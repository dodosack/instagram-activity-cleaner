# instagram-activity-cleaner

Remove your own Instagram likes, comments, reposts, and story replies in bulk
from the browser console. No login details, no external server, no extension.
The scripts click Instagram's own "Select", "Unlike", and "Delete" buttons for
you.

## Read this first

- **Do not run code you have not read.** Anyone can hide anything in a console
  script. Read every line before you paste it. That includes the scripts here.
- These scripts run in your own logged-in browser. A malicious script in the
  same place could read your session. So check what you paste, every time.
- Unliking cannot be undone automatically.
- Automating actions can trigger Instagram rate limits ("action blocked").
  Go slow. See [Limits](#limits).
- Your account, your risk. See [SECURITY.md](SECURITY.md).

## Where in Instagram

Log in on desktop Chrome, then open the likes page:

```
https://www.instagram.com/your_activity/interactions/likes
```

You can also reach it in the app/site menu:
Profile menu → **Your activity** → **Interactions** → **Likes**.

Comments, reposts, and story replies are on their own pages:
`https://www.instagram.com/your_activity/interactions/comments`
`https://www.instagram.com/your_activity/interactions/reposts`
`https://www.instagram.com/your_activity/interactions/story_replies`
(Profile menu → **Your activity** → **Interactions** → **Comments** / **Reposts** / **Story replies**).

## How to run

1. Open the likes page above while logged in.
2. Open DevTools: `F12` → **Console** tab.
3. If pasting is blocked, type `allow pasting`, press Enter, then paste.
4. Run the scripts in order. Each one tells you what to run next.

The scripts assume your Instagram UI is in **English** (labels `Select` and
`Unlike`). Other languages need the labels changed in the code.

## Scripts

Each type has its own folder under `scripts/`. Open the matching page (see
above) before running a group, and run the files in number order.

**Likes** — `scripts/likes/` — page `.../interactions/likes`

| File | What it does | Deletes? |
|------|--------------|----------|
| `1-diagnose.js` | Checks the selectors match the current UI | no |
| `2-check-select-mode.js` | Turns on selection mode, counts likes | no |
| `3-mini-test-3-likes.js` | Removes 3 likes so you see the flow | yes, 3 |
| `4-bulk-unlike.js` | Loops and removes likes in batches | yes |

**Comments** — `scripts/comments/` — page `.../interactions/comments`

| File | What it does | Deletes? |
|------|--------------|----------|
| `1-diagnose-comments.js` | Turns on selection mode, checks selectors | no |
| `2-mini-test-3-comments.js` | Deletes 3 comments so you see the flow | yes, 3 |
| `3-bulk-delete-comments.js` | Loops and deletes comments in batches | yes |

**Reposts** — `scripts/reposts/` — page `.../interactions/reposts`

| File | What it does | Deletes? |
|------|--------------|----------|
| `1-diagnose-reposts.js` | Turns on selection mode, checks selectors | no |
| `2-mini-test-3-reposts.js` | Removes up to 3 reposts so you see the flow | yes, 3 |
| `3-bulk-remove-reposts.js` | Loops and removes reposts in batches | yes |
| `4-unrepost-via-viewer.js` | **Recommended.** Un-reposts through the profile viewer | yes |

For reposts, use `4-unrepost-via-viewer.js` — the bulk list (`1`-`3`) deletes
unreliably. See `scripts/reposts/NOTES.md`.

**Story replies** — `scripts/story_replies/` — page `.../interactions/story_replies`

| File | What it does | Deletes? |
|------|--------------|----------|
| `1-diagnose-story-replies.js` | Turns on selection mode, checks selectors | no |
| `2-mini-test-3-story-replies.js` | Deletes 3 story replies so you see the flow | yes, 3 |
| `3-bulk-delete-story-replies.js` | Loops and deletes story replies in batches | yes |

Comments, reposts, and story replies all use the same delete flow (Select →
pick → Delete → confirm), so those three groups are near-identical; only likes
differ (they use "Unlike").

Doing the diagnose and mini-test first is how you find out whether it still
works before you delete anything at scale. Instagram changes its markup, so
the selectors can break; the diagnose step tells you early.

Each page uses slightly different controls, so the three groups are not
interchangeable.

### Reposts: known Instagram issue

Reposts delete unreliably on Instagram's side right now. With the default
"Newest to oldest" order, Instagram often shows a "deleted" toast but leaves
the repost in place — this happens **when you delete by hand too**, so it is
not caused by these scripts. Sorting **Oldest to newest** (Sort & filter)
before you start makes it much more reliable, but Instagram may still fail or
rate-limit after a while. If nothing is actually disappearing, stop and try
again later. The bulk script verifies the selection registered before deleting
so it won't report fake successes.

## Bulk script

The bulk scripts share the same settings at the top. The batch size is
randomized each cycle and the scripts occasionally skip an item or take a
longer pause, so the pattern looks less automated:

```js
const BATCH_MIN   = 5;      // fewest selected per cycle (randomized)
const BATCH_MAX   = 10;     // most selected per cycle (randomized)
const MAX_BATCH   = 100;    // hard cap per cycle (see below)
const SKIP_CHANCE = 0.12;   // chance to skip an item this pass (picked up later)
const MAX_TOTAL   = 200;    // stop after this many this session
const MIN_PAUSE   = 18000;  // min pause between cycles (ms)
const MAX_PAUSE   = 30000;  // max pause between cycles (ms)
const LONG_BREAK  = 0.2;    // chance of a longer human-like pause between cycles
```

Skipped items are not lost — they stay unselected and get picked up in a later
cycle.

**Batch size is capped at ~100.** The page only keeps ~25 rows in the DOM, so
the scripts scroll to load more until the batch is full. But Instagram's own
multi-select only allows about **100 at once** — past that it starts
deselecting, and asking it to unlike/delete a too-large batch can return an
HTTP 500 and leave the page stuck (you then have to reload and start the run
again). `MAX_BATCH = 100` keeps you under that. If you still hit 500s or a stuck
page, lower `BATCH_MAX`.

- **Start:** paste and press Enter.
- **Stop:** type `window.__STOP__ = true` and press Enter. It stops after the
  current cycle.
- Keep the tab visible. Background tabs get throttled and the timers slow down.

## Limits

Instagram limits how many actions you can do in a day. There is no official
number and it depends on the account.

- Start small. `MAX_TOTAL = 200` per session is a cautious default.
- If you have thousands of likes, spread it over several days.
- If you see "action blocked" or "try again later", stop and wait 24-48h.
  The bulk script stops on its own if it detects that message.

**HTTP 500 / 429 = rate limiting.** After a burst (often ~100-150 actions in a
short run, regardless of batch size) Instagram starts returning `500` or `429
Too Many Requests` on the unlike/delete request and the page can get stuck.
This is throttling, not a bug in the script. By default (`MAX_ERRORS = 1`) the
bulk scripts **stop on the first one** with a clear message instead of
pretending the list is empty. When it happens: reload the page and wait a while
(30-60+ minutes, sometimes longer) before running again. Smaller sessions and
longer pauses make it happen less.

You can raise `MAX_ERRORS` to make the script back off and keep retrying through
short throttles. **Be careful:** that means sending actions after Instagram
already told you to slow down, which is aggressive and can get your account
temporarily blocked. Leave it at 1 unless you accept that risk.

## Credits

The core of this project (how to find and click Instagram's Select / Unlike /
Delete buttons) is derived from Chidi's work:

- [iamceeso/instagram-bulk-likes-remover](https://github.com/iamceeso/instagram-bulk-likes-remover)
- [iamceeso/instagram-bulk-comment-deleter](https://github.com/iamceeso/instagram-bulk-comment-deleter)

This repo adds read-only checks, a small test step, a session limit,
action-block detection, the reposts support (worked out separately, since the
reposts confirm is a React popup that needs a leaf-level click), and the docs.

## License

MIT. See [LICENSE](LICENSE).
