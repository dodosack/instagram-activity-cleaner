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
  // ====================

  window.__STOP__ = false;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a));
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

  let total = 0, cycle = 0;
  console.log("%cStart. Stop with:  window.__STOP__ = true", "color:cyan;font-weight:bold");

  while (!window.__STOP__ && total < MAX_TOTAL) {
    if (blocked()) {
      console.warn("Instagram shows 'action blocked'. Stopped. Wait 24-48h before trying again.");
      break;
    }

    // Make sure selection mode is on.
    let icons = getIcons();
    if (icons.length === 0) {
      const sb = findSelect();
      if (!sb) { console.log("No comments left / Select gone. Done."); break; }
      realClick(sb);
      await sleep(1500);
      icons = getIcons();
    }
    if (icons.length === 0) { console.log("No comments left."); break; }

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

    total += sel;
    cycle++;
    console.log(`Cycle ${cycle}: deleted ${sel} | total ${total}/${MAX_TOTAL}`);

    // vary the pause; now and then take a longer break like a human would
    await sleep(Math.random() < LONG_BREAK ? rnd(MAX_PAUSE, MAX_PAUSE + 40000) : rnd(MIN_PAUSE, MAX_PAUSE));
  }

  console.log(`%cStopped. Deleted ${total} comments in ${cycle} cycles.`, "color:lime;font-weight:bold");
})();
