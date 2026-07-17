# instagram-bulk-likes-remover

Remove your own Instagram likes in bulk from the browser console. No login
details, no external server, no extension. The scripts click Instagram's own
"Select" and "Unlike" buttons for you.

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

Comments live on a separate page and are **not** covered yet:
`https://www.instagram.com/your_activity/interactions/comments`

## How to run

1. Open the likes page above while logged in.
2. Open DevTools: `F12` → **Console** tab.
3. If pasting is blocked, type `allow pasting`, press Enter, then paste.
4. Run the scripts in order. Each one tells you what to run next.

The scripts assume your Instagram UI is in **English** (labels `Select` and
`Unlike`). Other languages need the labels changed in the code.

## Scripts

Run them in this order the first time.

| File | What it does | Deletes? |
|------|--------------|----------|
| `scripts/01-diagnose.js` | Checks the selectors match the current UI | no |
| `scripts/02-check-select-mode.js` | Turns on selection mode, counts likes | no |
| `scripts/03-mini-test-3-likes.js` | Removes 3 likes so you see the flow | yes, 3 |
| `scripts/04-bulk-unlike.js` | Loops and removes likes in batches | yes |

Doing 01 → 02 → 03 first is how you find out whether it still works before
you delete anything at scale. Instagram changes its markup, so the selectors
can break; the diagnose step tells you early.

## Bulk script

Settings are at the top of `scripts/04-bulk-unlike.js`:

```js
const BATCH     = 8;      // likes per cycle
const MAX_TOTAL = 200;    // stop after this many this session
const MIN_PAUSE = 18000;  // min pause between cycles (ms)
const MAX_PAUSE = 30000;  // max pause between cycles (ms)
```

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

## License

MIT. See [LICENSE](LICENSE).
