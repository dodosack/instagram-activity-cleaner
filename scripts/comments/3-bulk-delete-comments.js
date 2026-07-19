/*
 * Step 7 - Bulk delete comments (loops until the session limit or none left)
 *
 * WARNING: this deletes real data and cannot be undone. Read the code before
 * you run it. Do not run scripts you have not read.
 *
 * Selectors and click flow derived from Chidi's MIT-licensed
 * instagram-bulk-comment-deleter (github.com/iamceeso).
 *
 * Run on: https://www.instagram.com/your_activity/interactions/comments
 *
 * Start:  paste and press Enter.
 * Stop:   type   window.__STOP__ = true   and press Enter.
 *         It stops after the current cycle.
 *
 * Keep the tab visible. Background tabs get throttled by the browser
 * and the timers slow down.
 */
(async function bulkDeleteComments() {
  // ===== settings =====
  const BATCH_MIN   = 5;      // fewest comments selected per cycle (randomized)
  const BATCH_MAX   = 10;     // most comments selected per cycle (randomized)
  const MAX_BATCH   = 100;    // hard cap - Instagram deselects past ~100 per action (and can 500)
  const SKIP_CHANCE = 0.12;   // chance to skip an item this pass (picked up later)
  const MAX_TOTAL   = 200;    // stop after this many comments this session (rate-limit guard)
  const MIN_PAUSE   = 18000;  // min pause between cycles (ms)
  const MAX_PAUSE   = 30000;  // max pause between cycles (ms)
  const LONG_BREAK  = 0.2;    // chance of a longer human-like pause between cycles
  const SELECT_RETRIES = 3;   // if the list looks empty, re-check this many times (page reloads slowly after big deletes)
  const SELECT_PAUSES = [5000, 8000, 12000]; // escalating waits (ms) between those re-checks; extra retries reuse the last value
  const MAX_RETRIES = 1;      // backoff-and-retry this many times on a 429 before stopping; 0 = stop on the first 429
  const BACKOFF_MIN = 60000;  // wait at least this long after a 429 (ms)
  const BACKOFF_MAX = 120000; // wait at most this long after a 429 (ms)
  const RECOVER_500  = 1;      // after a 500 breaks the page, try to restore it in place this many times (0 = stop immediately)
  const RECOVER_MIN  = 60000;  // wait at least this long before the restore attempt (ms)
  const RECOVER_MAX  = 100000; // wait at most this long before the restore attempt (ms)
  // A 500 on the real delete action breaks the page - the script tries the
  // in-place tab-switch recovery (RECOVER_500 times), then stops. A 429 (Too
  // Many Requests) gets one backoff-and-retry by default; if it comes back,
  // we stop.
  // WARNING: raising MAX_RETRIES keeps sending actions after Instagram already
  // told you to slow down. That is aggressive and can get your account
  // temporarily blocked. Leave it at 1 unless you accept that risk.
  // ====================

  window.__STOP__ = false;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a));

  // Watch Instagram's own action requests. A 500 here is almost always rate
  // limiting after a burst, not a bug - we detect it and stop cleanly instead
  // of misreporting "No comments left" when the page has actually broken.
  let actionError = null;   // HTTP error on the real delete action
  let loadMore429 = false;  // 429 on pagination ('load more') this cycle
  const __origFetch = window.fetch;
  window.fetch = function (...a) {
    const p = __origFetch.apply(this, a);
    const u = typeof a[0] === "string" ? a[0] : (a[0] && a[0].url) || "";
    if (u.includes("wbloks/fetch") && u.includes("type=action")) {
      p.then(r => {
        if (!r.ok) {
          if (u.includes("_next")) {
            if (r.status === 429) { loadMore429 = true; console.warn("HTTP 429 registered on 'load more' - Instagram is throttling (the deletes themselves still go through)."); }
            else console.warn(`Note: 'load more' failed (HTTP ${r.status}) - continuing.`);
          } else actionError = r.status; // error on the real delete action
        }
      }).catch(() => { actionError = "network"; });
    }
    return p;
  };
  const realClick = (el) => {
    el.scrollIntoView({ block: "center" });
    ["mousedown", "mouseup", "click"].forEach(t =>
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, buttons: 1 })));
  };
  const findSelect = () => [...document.querySelectorAll('div[data-bloks-name="bk.components.Flexbox"]')]
    .find(el => el.innerText?.trim() === "Select");
  const getIcons = () => document.querySelectorAll('div[data-bloks-name="ig.components.Icon"][style*="circle__outline"]');
  const findDelete = () => {
    const span = [...document.querySelectorAll('span[data-bloks-name="bk.components.TextSpan"]')]
      .find(s => s.innerText?.trim() === "Delete");
    return span?.closest('div[style*="pointer-events: auto"]');
  };
  const blocked = () => [...document.querySelectorAll("*")]
    .some(el => /action blocked|try again later|we restrict/i.test(el.innerText || ""));

  // After a 500 the list often breaks (endless spinner). A full page reload
  // would kill this script, but the page is an SPA: switching to another tab
  // and back makes Instagram re-render the list in place. Try that before
  // giving up.
  const findTab = (label) => {
    const re = new RegExp("^" + label + "$", "i");
    const els = [...document.querySelectorAll("div,span")].filter(el => re.test((el.innerText || "").trim()));
    return els.length ? els[els.length - 1] : null; // last match = deepest element
  };
  let recoverTries = 0;
  const tryRecover = async (err) => {
    actionError = null;
    loadMore429 = false;
    recoverTries++;
    if (recoverTries > RECOVER_500) return false;
    const wait = rnd(RECOVER_MIN, RECOVER_MAX);
    console.warn(`HTTP ${err} broke the page - waiting ~${Math.round(wait / 1000)}s, then switching tabs to re-render the list without a reload (attempt ${recoverTries}/${RECOVER_500}).`);
    await sleep(wait);
    const away = findTab("Likes");
    if (away) { console.log("%cRecovery: switching to the Likes tab...", "color:orange;font-weight:bold"); realClick(away); await sleep(2500); }
    else console.warn("Recovery: Likes tab not found - cannot switch away.");
    const home = findTab("Comments");
    if (home) { console.log("%cRecovery: switching back to the Comments tab...", "color:orange;font-weight:bold"); realClick(home); await sleep(3500); }
    else console.warn("Recovery: Comments tab not found - the page may be too broken.");
    console.log("%cRecovery: tab switch done - re-checking the list.", "color:orange;font-weight:bold");
    return true;
  };

  let total = 0, cycle = 0, errorStreak = 0;
  console.log("%cStart. Stop with:  window.__STOP__ = true", "color:cyan;font-weight:bold");

  while (!window.__STOP__ && total < MAX_TOTAL) {
    // NOTE: actionError/loadMore429 are NOT reset here. Throttled responses
    // arrive seconds late (often during the between-cycle pause), so the flags
    // are only cleared where they are handled - resetting them here wiped them
    // before the check ever saw them.
    if (blocked()) {
      console.warn("Instagram shows 'action blocked'. Stopped. Wait 24-48h before trying again.");
      break;
    }

    // Make sure selection mode is on. After a bigger delete the page can take
    // a while to re-render - retry with pauses before concluding it is empty.
    let icons = getIcons();
    for (let att = 1; icons.length === 0 && att <= SELECT_RETRIES && !window.__STOP__; att++) {
      const sb = findSelect();
      const wait = SELECT_PAUSES[Math.min(att, SELECT_PAUSES.length) - 1];
      if (sb) realClick(sb);
      else console.log(`List not ready yet (attempt ${att}/${SELECT_RETRIES}) - waiting ${Math.round(wait / 1000)}s for the page to load...`);
      await sleep(sb ? 1500 : wait);
      icons = getIcons();
    }
    if (icons.length === 0) {
      if (!findSelect()) {
        // Select still gone after the retries: either truly empty, or the page
        // broke after a throttled action. Instagram's 500 is slow (~15-20s);
        // if we were mid-run wait for it before deciding.
        if (total > 0) { for (let i = 0; i < 18 && !actionError; i++) await sleep(1000); }
        if (actionError) {
          const err = actionError;
          if (err !== 429 && await tryRecover(err)) continue;
          console.warn(`Instagram returned HTTP ${err} - rate limited, the page broke mid-run. Reload and wait 30-60+ min before running again.`);
        }
        else console.log("Select gone. Either all comments are removed, or Instagram rate-limited you (the page can break silently). If comments remain, reload and wait before running again.");
      } else {
        console.log("No comments left.");
      }
      break;
    }

    // Select a randomized batch. Instagram keeps only ~25 rows in the DOM at a
    // time, so scroll to load more until we reach the target (or run out).
    const target = Math.min(rnd(BATCH_MIN, BATCH_MAX + 1), MAX_BATCH);
    const skipped = new Set();
    let sel = 0, emptyScrolls = 0;
    while (sel < target && !window.__STOP__ && emptyScrolls < 4) {
      let picked = 0;
      for (const icon of getIcons()) {
        if (sel >= target) break;
        if (skipped.has(icon)) continue;
        const btn = icon.closest('[role="button"]');
        if (!btn) continue;
        if (Math.random() < SKIP_CHANCE) { skipped.add(icon); continue; } // stays for a later cycle
        realClick(btn);
        sel++;
        picked++;
        await sleep(rnd(450, 1100));
      }
      if (sel < target) {
        window.scrollBy(0, 1600);            // load more rows
        await sleep(1100);
        emptyScrolls = picked === 0 ? emptyScrolls + 1 : 0;
      }
    }
    if (sel === 0) { console.log("Nothing selectable. Done."); break; }

    // Delete + confirm.
    await sleep(1200);
    const deleteBtn = findDelete();
    if (!deleteBtn) { console.warn("Delete control not found. Stopped."); break; }
    realClick(deleteBtn);

    await sleep(1500);
    const confirmBtn = [...document.querySelectorAll("button")]
      .find(b => b.innerText?.trim() === "Delete");
    if (!confirmBtn) { console.warn("Confirm dialog not found. Stopped."); break; }
    confirmBtn.focus();
    await sleep(100);
    confirmBtn.click();

    // let Instagram process, then check for throttling on the requests
    await sleep(1500);
    if (actionError && actionError !== 429) {
      // 500 (or network error) on the real action: the page usually breaks here
      const err = actionError;
      if (await tryRecover(err)) continue;
      console.warn(`Instagram returned HTTP ${err} on the delete action - hard stop. Reload and wait 30-60+ min (sometimes hours) before trying again.`);
      break;
    }
    if (actionError === 429) {
      errorStreak++;
      if (errorStreak > MAX_RETRIES) {
        console.warn(`HTTP 429 on the delete action again (${errorStreak}x) - you are rate limited. Stopping. Reload and wait 30-60+ min before trying again.`);
        break;
      }
      const back = rnd(BACKOFF_MIN, BACKOFF_MAX);
      console.warn(`HTTP 429 registered on the delete action (retry ${errorStreak}/${MAX_RETRIES}) - backing off ~${Math.round(back / 1000)}s, then retrying remaining comments. Warning: continuing after a 429 can result in a block.`);
      actionError = null;
      loadMore429 = false; // one backoff covers this throttle episode
      await sleep(back);
      continue;
    }

    total += sel;
    cycle++;
    console.log(`Cycle ${cycle}: deleted ${sel} | total ${total}/${MAX_TOTAL}`);

    if (loadMore429) {
      // pagination got throttled; the deletes went through, but Instagram is
      // telling us to slow down - back off once, stop if it keeps happening
      loadMore429 = false;
      errorStreak++;
      if (errorStreak > MAX_RETRIES) {
        console.warn(`HTTP 429 on 'load more' again (${errorStreak}x) - Instagram keeps throttling. Stopping. Wait 30-60+ min before running again.`);
        break;
      }
      const back = rnd(BACKOFF_MIN, BACKOFF_MAX);
      console.warn(`HTTP 429 registered on 'load more' (retry ${errorStreak}/${MAX_RETRIES}) - backing off ~${Math.round(back / 1000)}s before continuing.`);
      await sleep(back);
      continue;
    }
    errorStreak = 0;
    recoverTries = 0;

    // vary the pause; now and then take a longer break like a human would
    await sleep(Math.random() < LONG_BREAK ? rnd(MAX_PAUSE, MAX_PAUSE + 40000) : rnd(MIN_PAUSE, MAX_PAUSE));
  }

  window.fetch = __origFetch;
  console.log(`%cStopped. Deleted ${total} comments in ${cycle} cycles.`, "color:lime;font-weight:bold");
})();
