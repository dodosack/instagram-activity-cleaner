/*
 * Step 3 (story replies) - Bulk delete (loops until the session limit or none left)
 *
 * WARNING: this deletes real data and cannot be undone. Read the code before
 * you run it. Do not run scripts you have not read.
 *
 * Same flow as the comments scripts (Select -> pick items -> Delete -> confirm).
 *
 * Run on: https://www.instagram.com/your_activity/interactions/story_replies
 *
 * Start:  paste and press Enter.
 * Stop:   type   window.__STOP__ = true   and press Enter.
 *         It stops after the current cycle.
 *
 * Keep the tab visible. Background tabs get throttled by the browser
 * and the timers slow down.
 */
(async function bulkDeleteStoryReplies() {
  // ===== settings =====
  const BATCH     = 8;      // items per cycle
  const MAX_TOTAL = 200;    // stop after this many this session (rate-limit guard)
  const MIN_PAUSE = 18000;  // min pause between cycles (ms)
  const MAX_PAUSE = 30000;  // max pause between cycles (ms)
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
      if (!sb) { console.log("Nothing left / Select gone. Done."); break; }
      realClick(sb);
      await sleep(1500);
      icons = getIcons();
    }
    if (icons.length === 0) { console.log("Nothing left."); break; }

    // Select a batch.
    let sel = 0;
    for (const icon of icons) {
      if (sel >= BATCH) break;
      icon.scrollIntoView({ behavior: "smooth", block: "center" });
      await sleep(400);
      const btn = icon.closest('[role="button"]');
      if (!btn) continue;
      realClick(btn);
      sel++;
      await sleep(rnd(500, 900));
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

    await sleep(rnd(MIN_PAUSE, MAX_PAUSE));
  }

  console.log(`%cStopped. Deleted ${total} story replies in ${cycle} cycles.`, "color:lime;font-weight:bold");
})();
