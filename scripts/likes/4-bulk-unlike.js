/*
 * Step 4 - Bulk unlike (loops until the session limit or no likes left)
 *
 * Selectors and click flow derived from Chidi's MIT-licensed
 * instagram-bulk-likes-remover (github.com/iamceeso).
 *
 * WARNING: this deletes real data and cannot be undone automatically.
 * Read the code before you run it. Do not run scripts you have not read.
 *
 * Run on: https://www.instagram.com/your_activity/interactions/likes
 *
 * Start:  paste and press Enter.
 * Stop:   type   window.__STOP__ = true   and press Enter.
 *         It stops after the current cycle.
 *
 * Keep the tab visible. Background tabs get throttled by the browser
 * and the timers slow down.
 */
(async function bulkUnlike() {
  // ===== settings =====
  const BATCH_MIN   = 5;      // fewest likes selected per cycle (randomized)
  const BATCH_MAX   = 10;     // most likes selected per cycle (randomized)
  const MAX_BATCH   = 100;    // hard cap - Instagram deselects past ~100 per action (and can 500)
  const SKIP_CHANCE = 0.12;   // chance to skip an item this pass (picked up later)
  const MAX_TOTAL   = 200;    // stop after this many likes this session (rate-limit guard)
  const MIN_PAUSE   = 18000;  // min pause between cycles (ms)
  const MAX_PAUSE   = 30000;  // max pause between cycles (ms)
  const LONG_BREAK  = 0.2;    // chance of a longer human-like pause between cycles
  const SELECT_RETRIES = 3;   // if the list looks empty, re-check this many times (page reloads slowly after big deletes)
  const SELECT_PAUSES = [5000, 8000, 12000]; // escalating waits (ms) between those re-checks; extra retries reuse the last value
  const SORT_ORDER = "auto";  // "auto" = keep whatever the page is set to when you start;
                              // "newest" / "oldest" = force that order and put it back
                              // whenever the page resets it (every re-render does)
  const MAX_RETRIES = 1;      // backoff-and-retry this many times on a 429 before stopping; 0 = stop on the first 429, -1 = retry forever
  const BACKOFF_MIN = 60000;  // wait at least this long after a 429 (ms)
  const BACKOFF_MAX = 120000; // wait at most this long after a 429 (ms)
  const RECOVER_500  = 1;      // after a 500 breaks the page, try to restore it in place this many times (0 = stop immediately, -1 = keep trying forever)
  const RECOVER_MIN  = 60000;  // wait at least this long before the restore attempt (ms)
  const RECOVER_MAX  = 100000; // wait at most this long before the restore attempt (ms)
  const EMPTY_RECOVERIES = 3;  // if the list vanishes with NO failed request (what a 429 leaves
                               // behind), try the same tab switch this many times; -1 = keep trying.
                               // Reset as soon as the list is back, so only failures count.
  // A 500 on the real unlike action breaks the page - the script tries the
  // in-place tab-switch recovery (RECOVER_500 times), then stops. A 429 (Too
  // Many Requests) gets one backoff-and-retry by default; if it comes back,
  // we stop. -1 on either limit means retry forever and never stop for it.
  // WARNING: raising these keeps sending actions after Instagram already told
  // you to slow down. That is aggressive and can get your account temporarily
  // blocked - especially -1, which never backs out on its own.
  // ====================

  window.__STOP__ = false;
  const RETRY_LIMIT = MAX_RETRIES < 0 ? "unlimited" : MAX_RETRIES;
  const RECOVER_LIMIT = RECOVER_500 < 0 ? "unlimited" : RECOVER_500;
  const EMPTY_LIMIT = EMPTY_RECOVERIES < 0 ? "unlimited" : EMPTY_RECOVERIES;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a));

  // Watch Instagram's own action requests. A 500 here is almost always rate
  // limiting after a burst, not a bug - we detect it and stop cleanly instead
  // of misreporting "No likes left" when the page has actually broken.
  let actionError = null;   // HTTP error on the real unlike action
  let loadMore429 = false;  // 429 on pagination ('load more') this cycle
  const __origFetch = window.fetch;
  window.fetch = function (...a) {
    const p = __origFetch.apply(this, a);
    const u = typeof a[0] === "string" ? a[0] : (a[0] && a[0].url) || "";
    if (u.includes("wbloks/fetch") && u.includes("type=action")) {
      p.then(r => {
        if (!r.ok) {
          if (u.includes("_next")) {
            if (r.status === 429) { loadMore429 = true; console.warn("HTTP 429 registered on 'load more' - Instagram is throttling (the unlikes themselves still go through)."); }
            else console.warn(`Note: 'load more' failed (HTTP ${r.status}) - continuing.`);
          } else actionError = r.status; // error on the real unlike action
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
  const blocked = () => [...document.querySelectorAll("*")]
    .some(el => /action blocked|try again later|we restrict/i.test(el.innerText || ""));

  // Sort order. Every re-render (reload, tab switch, the recovery below) drops
  // the list back to the default "Newest to oldest", so we read what is set,
  // remember it, and put it back when it flips. Flow recorded 2026-07-20:
  // Sort & filter -> the order option -> Apply, all div[role=button] with an
  // exact aria-label; the current order is shown as plain text next to the
  // Sort & filter button.
  const SORT_LABEL = { newest: "Newest to oldest", oldest: "Oldest to newest" };
  const byAria = (label) => [...document.querySelectorAll('[role="button"]')]
    .find(el => (el.getAttribute("aria-label") || "").trim() === label);
  // only VISIBLE text counts - the closed sort sheet can stay in the DOM with
  // both options in it, which would make every read look like "newest"
  const visible = (el) => el.offsetParent !== null;
  const readSort = () => {
    const texts = [...document.querySelectorAll("div,span")]
      .filter(visible).map(el => (el.innerText || "").trim());
    const hits = Object.keys(SORT_LABEL).filter(key => texts.includes(SORT_LABEL[key]));
    return hits.length === 1 ? hits[0] : null; // both visible = sheet is open, cannot tell
  };
  const applySort = async (order) => {
    if (readSort() === order) return true;
    // the page can still be rendering (right after a recovery tab switch it
    // always is), so wait for the button instead of giving up on the spot
    let sf = byAria("Sort & filter");
    for (let i = 0; i < 8 && !sf; i++) { await sleep(1500); sf = byAria("Sort & filter"); }
    if (!sf) { console.warn("Sort & filter button not found - leaving the sort order alone."); return false; }
    realClick(sf);
    await sleep(1500);
    const opt = byAria(SORT_LABEL[order]);
    if (!opt) { console.warn(`Sort option '${SORT_LABEL[order]}' not found - leaving the sort order alone.`); return false; }
    realClick(opt);
    await sleep(800);
    const apply = byAria("Apply");
    if (!apply) { console.warn("Apply button not found - the sort sheet may still be open."); return false; }
    realClick(apply);
    await sleep(3000); // the list reloads
    const now = readSort();
    if (now === order) { console.log(`%cSort order set to '${SORT_LABEL[order]}'.`, "color:orange;font-weight:bold"); return true; }
    console.warn(`Tried to set '${SORT_LABEL[order]}' but the page shows '${now ? SORT_LABEL[now] : "something unreadable"}'.`);
    return false;
  };

  // "Something went wrong - There was a problem unliking some or all of your
  // content." Instagram shows this modal after a throttled action. The likes
  // usually ARE removed; the modal just blocks the page until OK is pressed.
  // Its OK is a plain <button> with no bloks/aria/role attributes (recorded
  // 2026-07-20), so the same focus+click used for the confirm dialog works.
  // Clicking it the millisecond it appears does NOT bring the list back (the
  // page stays blank); by hand, where a few seconds pass first, it does. So
  // let the modal settle, then click ONCE - a second click lands on the
  // closing dialog and seems to kill the re-render.
  const findOk = () => [...document.querySelectorAll("button")]
    .find(b => (b.innerText || "").trim() === "OK");
  const DIALOG_SETTLE = 4000; // wait before pressing OK
  const DIALOG_AFTER  = 6000; // wait after pressing OK, before retrying the list
  const DIALOG_RETRY  = 2000; // re-check pause after a dialog (instead of the long SELECT_PAUSES)
  let justDismissed = false;  // set by dismissError, consumed by the select loop
  let dialogSpent = 0;        // ms burned on the dialog this cycle - credited against the cycle pause
  const dismissError = async () => {
    if (!findOk()) return false;
    const t0 = Date.now();
    console.warn(`'Something went wrong' dialog is up - waiting ${DIALOG_SETTLE / 1000}s, then pressing OK.`);
    await sleep(DIALOG_SETTLE);
    const ok = findOk();
    if (!ok) return false; // gone on its own
    ok.focus();
    ok.click();
    await sleep(600);
    if (document.contains(ok)) realClick(ok); // native click did not take
    console.warn(`Pressed OK - waiting ${DIALOG_AFTER / 1000}s for the page to come back, then retrying.`);
    await sleep(DIALOG_AFTER);
    justDismissed = true; // keep the following re-checks short, not 5/8/12s
    dialogSpent += Date.now() - t0; // waiting here counts towards the cycle pause
    return true;
  };

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
  // Counts only the tab switches that did NOT bring the list back (see the 429
  // case below); a genuinely empty list must still end the run.
  let emptyRecoveries = 0;
  const tryRecover = async (err) => {
    actionError = null;
    loadMore429 = false;
    recoverTries++;
    if (RECOVER_500 >= 0 && recoverTries > RECOVER_500) return false;
    const wait = rnd(RECOVER_MIN, RECOVER_MAX);
    const what = typeof err === "number" ? `HTTP ${err}` : err; // callers pass a status or a reason
    console.warn(`${what} broke the page - waiting ~${Math.round(wait / 1000)}s, then switching tabs to re-render the list without a reload (attempt ${recoverTries}/${RECOVER_LIMIT}).`);
    await sleep(wait);
    await dismissError(); // the modal would eat the tab clicks
    const away = findTab("Comments");
    if (away) { console.log("%cRecovery: switching to the Comments tab...", "color:orange;font-weight:bold"); realClick(away); await sleep(2500); }
    else console.warn("Recovery: Comments tab not found - cannot switch away.");
    const home = findTab("Likes");
    if (home) { console.log("%cRecovery: switching back to the Likes tab...", "color:orange;font-weight:bold"); realClick(home); await sleep(3500); }
    else console.warn("Recovery: Likes tab not found - the page may be too broken.");
    console.log("%cRecovery: tab switch done - re-checking the list.", "color:orange;font-weight:bold");
    return true;
  };

  // Decide the order ONCE, before anything is deleted.
  let wantSort = null, sortFails = 0;
  if (SORT_ORDER === "auto") {
    wantSort = readSort();
    console.log(wantSort
      ? `Sort order: keeping '${SORT_LABEL[wantSort]}' (auto - whatever was set when you started).`
      : "Sort order: could not read the current setting - it will not be enforced.");
  } else if (SORT_LABEL[SORT_ORDER]) {
    wantSort = SORT_ORDER;
    await applySort(wantSort);
  } else {
    console.warn(`SORT_ORDER '${SORT_ORDER}' is not valid - use "auto", "newest" or "oldest". Leaving the sort order alone.`);
  }

  let total = 0, cycle = 0, errorStreak = 0;
  console.log("%cStart. Stop with:  window.__STOP__ = true", "color:cyan;font-weight:bold");

  cycles:
  while (!window.__STOP__ && total < MAX_TOTAL) {
    // NOTE: actionError/loadMore429 are NOT reset here. Throttled responses
    // arrive seconds late (often during the between-cycle pause), so the flags
    // are only cleared where they are handled - resetting them here wiped them
    // before the check ever saw them.
    justDismissed = false; // only a dialog handled IN this cycle shortens its re-checks
    await dismissError(); // leftover modal from the last cycle
    // a re-render (recovery tab switch, or Instagram doing it on its own) puts
    // the list back to the default order - undo that before selecting anything
    if (wantSort && readSort() !== wantSort) {
      console.warn(`Sort order was reset - putting it back to '${SORT_LABEL[wantSort]}'.`);
      if (!await applySort(wantSort) && ++sortFails >= 2) {
        wantSort = null; // do not fight the page every cycle
        console.warn("Could not set the sort order twice in a row - continuing with whatever the page shows.");
      }
    }
    if (blocked()) {
      console.warn("Instagram shows 'action blocked'. Stopped. Wait 24-48h before trying again.");
      break;
    }

    // Make sure selection mode is on. If the rows are gone, check for the
    // error dialog FIRST - when it is up it is blocking the page, so waiting
    // out the retries would just burn time. Press OK, then retry the list.
    let icons = getIcons();
    if (icons.length === 0 && await dismissError()) icons = getIcons();
    for (let att = 1; icons.length === 0 && att <= SELECT_RETRIES && !window.__STOP__; att++) {
      const sb = findSelect();
      // right after a dismissed dialog we already waited DIALOG_AFTER - use
      // short re-checks so the waits do not stack up to half a minute
      const wait = justDismissed ? DIALOG_RETRY : SELECT_PAUSES[Math.min(att, SELECT_PAUSES.length) - 1];
      if (sb) { console.log(`Retry ${att}/${SELECT_RETRIES}: list is back - turning selection mode on again...`); realClick(sb); }
      else console.log(`List not ready yet (attempt ${att}/${SELECT_RETRIES}) - waiting ${Math.round(wait / 1000)}s for the page to load...`);
      const slept = sb ? 1500 : wait;
      await sleep(slept);
      if (justDismissed) dialogSpent += slept;
      icons = getIcons();
    }
    justDismissed = false;
    if (icons.length === 0) {
      if (!findSelect()) {
        // Select still gone after the retries: either truly empty, or the page
        // broke after a throttled action. Instagram's 500 is slow (~15-20s), so
        // if we were mid-run give it a moment to arrive before deciding - and
        // watch for the error dialog, which often shows up without any failed
        // request at all. If it does, click OK and carry on immediately.
        if (total > 0) {
          for (let i = 0; i < 18 && !actionError; i++) {
            if (await dismissError()) continue cycles; // start the cycle over, retries and all
            await sleep(1000);
          }
        }
        if (actionError) {
          const err = actionError;
          if (err !== 429 && await tryRecover(err)) continue;
          console.warn(`Instagram returned HTTP ${err} - rate limited, the page broke mid-run. Reload and wait 30-60+ min before running again.`);
        }
        else {
          // No request failed, but the list is gone. That is what a 429 leaves
          // behind: the flag was consumed by the backoff, so nothing counts as
          // an error any more, and the page dropped the list anyway. Give it
          // the same tab switch the 500 path gets before concluding anything.
          if (total > 0 && (EMPTY_RECOVERIES < 0 || emptyRecoveries < EMPTY_RECOVERIES)) {
            emptyRecoveries++;
            console.warn(`The list is gone but no request failed - trying the tab switch (${emptyRecoveries}/${EMPTY_LIMIT}) before giving up.`);
            if (await tryRecover("The list disappeared without a failed request")) continue;
          }
          console.log("Select gone. Either all likes are removed, or Instagram rate-limited you (the page can break silently). If likes remain, reload and wait before running again.");
        }
      } else {
        // Selection mode is available but no rows are loaded. After a
        // re-render that usually means the list is still filling in, and
        // ending a long run early is worse than waiting a few more seconds.
        console.log("Select is back but no rows yet - checking once more before calling it done...");
        realClick(findSelect());
        await sleep(5000);
        if (getIcons().length > 0) continue;
        console.log("No likes left.");
      }
      break;
    }

    // The list is back, so whatever we did worked. Both recovery budgets count
    // ATTEMPTS THAT FAILED - a recovery that brought the page back must not
    // spend one, or a long run dies on its second unrelated error.
    recoverTries = 0;
    emptyRecoveries = 0;

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

    // Unlike + confirm.
    await sleep(1200);
    const unlikeBtn = [...document.querySelectorAll("span")]
      .find(el => el.innerText?.trim() === "Unlike")?.closest("button, div");
    if (!unlikeBtn) { console.warn("Unlike button not found. Stopped."); break; }
    realClick(unlikeBtn);

    await sleep(1000);
    const confirmBtn = [...document.querySelectorAll("button")]
      .find(b => b.innerText?.trim() === "Unlike");
    if (!confirmBtn) { console.warn("Confirm dialog not found. Stopped."); break; }
    confirmBtn.focus();
    await sleep(100);
    confirmBtn.click();

    // let Instagram process, then check for throttling on the requests
    await sleep(1500);
    await dismissError();
    if (actionError && actionError !== 429) {
      // 500 (or network error) on the real action: the page usually breaks here
      const err = actionError;
      if (await tryRecover(err)) continue;
      console.warn(`Instagram returned HTTP ${err} on the unlike action - hard stop. Reload and wait 30-60+ min (sometimes hours) before trying again.`);
      break;
    }
    if (actionError === 429) {
      errorStreak++;
      if (MAX_RETRIES >= 0 && errorStreak > MAX_RETRIES) {
        console.warn(`HTTP 429 on the unlike action again (${errorStreak}x) - you are rate limited. Stopping. Reload and wait 30-60+ min before trying again.`);
        break;
      }
      const back = rnd(BACKOFF_MIN, BACKOFF_MAX);
      console.warn(`HTTP 429 registered on the unlike action (retry ${errorStreak}/${RETRY_LIMIT}) - backing off ~${Math.round(back / 1000)}s, then retrying still-liked posts. Warning: continuing after a 429 can result in a block.`);
      actionError = null;
      loadMore429 = false; // one backoff covers this throttle episode
      await sleep(back);
      continue;
    }

    total += sel;
    cycle++;
    console.log(`Cycle ${cycle}: removed ${sel} | total ${total}/${MAX_TOTAL}`);

    if (loadMore429) {
      // pagination got throttled; the unlikes went through, but Instagram is
      // telling us to slow down - back off once, stop if it keeps happening
      loadMore429 = false;
      errorStreak++;
      if (MAX_RETRIES >= 0 && errorStreak > MAX_RETRIES) {
        console.warn(`HTTP 429 on 'load more' again (${errorStreak}x) - Instagram keeps throttling. Stopping. Wait 30-60+ min before running again.`);
        break;
      }
      const back = rnd(BACKOFF_MIN, BACKOFF_MAX);
      console.warn(`HTTP 429 registered on 'load more' (retry ${errorStreak}/${RETRY_LIMIT}) - backing off ~${Math.round(back / 1000)}s before continuing.`);
      await sleep(back);
      continue;
    }
    errorStreak = 0;

    // vary the pause; now and then take a longer break like a human would
    const base = Math.random() < LONG_BREAK ? rnd(MAX_PAUSE, MAX_PAUSE + 40000) : rnd(MIN_PAUSE, MAX_PAUSE);
    const pause = Math.max(DIALOG_AFTER, base - dialogSpent); // dialog time already was a pause
    if (dialogSpent) console.log(`Pause ${Math.round(pause / 1000)}s (${Math.round(base / 1000)}s minus the ${Math.round(dialogSpent / 1000)}s already spent on the error dialog, never below ${DIALOG_AFTER / 1000}s).`);
    dialogSpent = 0;
    await sleep(pause);
  }

  window.fetch = __origFetch;
  console.log(`%cStopped. Removed ${total} likes in ${cycle} cycles.`, "color:lime;font-weight:bold");
})();
