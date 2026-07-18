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
  const MAX_ERRORS  = 1;      // 1 = stop on the first 429/500; raise to ride out short throttles with backoff
  const BACKOFF_MIN = 60000;  // wait at least this long after a throttle (ms)
  const BACKOFF_MAX = 120000; // wait at most this long after a throttle (ms)
  // WARNING: raising MAX_ERRORS keeps sending actions after Instagram already
  // told you to slow down (429/500). That is aggressive and can get your
  // account temporarily blocked. Leave it at 1 unless you accept that risk.
  // ====================

  window.__STOP__ = false;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a));

  // Watch Instagram's own action requests. A 500 here is almost always rate
  // limiting after a burst, not a bug - we detect it and stop cleanly instead
  // of misreporting "No likes left" when the page has actually broken.
  let httpError = null;
  const __origFetch = window.fetch;
  window.fetch = function (...a) {
    const p = __origFetch.apply(this, a);
    const u = typeof a[0] === "string" ? a[0] : (a[0] && a[0].url) || "";
    if (u.includes("wbloks/fetch") && u.includes("type=action")) {
      p.then(r => { if (!r.ok) httpError = r.status; }).catch(() => { httpError = "network"; });
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

  let total = 0, cycle = 0, errorStreak = 0;
  console.log("%cStart. Stop with:  window.__STOP__ = true", "color:cyan;font-weight:bold");

  while (!window.__STOP__ && total < MAX_TOTAL) {
    httpError = null;
    if (blocked()) {
      console.warn("Instagram shows 'action blocked'. Stopped. Wait 24-48h before trying again.");
      break;
    }

    // Make sure selection mode is on.
    let icons = getIcons();
    if (icons.length === 0) {
      const sb = findSelect();
      if (!sb) {
        // Select gone: either truly empty, or the page broke after a throttled
        // action. Instagram's 500 is slow (~15-20s), so if we were mid-run give
        // it a moment to arrive before deciding.
        if (total > 0) { for (let i = 0; i < 18 && !httpError; i++) await sleep(1000); }
        if (httpError) console.warn(`Instagram returned HTTP ${httpError} - rate limited, the page broke mid-run. Reload and wait 30-60+ min before running again.`);
        else console.log("Select gone. Either all likes are removed, or Instagram rate-limited you (the page can break silently). If likes remain, reload and wait before running again.");
        break;
      }
      realClick(sb);
      await sleep(1500);
      icons = getIcons();
    }
    if (icons.length === 0) { console.log("No likes left."); break; }

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

    // let Instagram process, then check for a throttle (429) or 500 on the action
    await sleep(1500);
    if (httpError) {
      errorStreak++;
      if (errorStreak >= MAX_ERRORS) {
        console.warn(`Instagram returned HTTP ${httpError} ${errorStreak}x in a row - you are rate limited. Stopping. Reload and wait longer (hours) before trying again.`);
        break;
      }
      const back = rnd(BACKOFF_MIN, BACKOFF_MAX);
      console.warn(`Instagram returned HTTP ${httpError} (rate limit). Backing off ~${Math.round(back / 1000)}s, then retrying (${errorStreak}/${MAX_ERRORS}). Still-liked posts get retried.`);
      await sleep(back);
      continue;
    }
    errorStreak = 0;

    total += sel;
    cycle++;
    console.log(`Cycle ${cycle}: removed ${sel} | total ${total}/${MAX_TOTAL}`);

    // vary the pause; now and then take a longer break like a human would
    await sleep(Math.random() < LONG_BREAK ? rnd(MAX_PAUSE, MAX_PAUSE + 40000) : rnd(MIN_PAUSE, MAX_PAUSE));
  }

  window.fetch = __origFetch;
  console.log(`%cStopped. Removed ${total} likes in ${cycle} cycles.`, "color:lime;font-weight:bold");
})();
