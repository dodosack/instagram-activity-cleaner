/*
 * Step 4 - Bulk unlike (loops until the session limit or no likes left)
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
  const BATCH     = 8;      // likes per cycle
  const MAX_TOTAL = 200;    // stop after this many likes this session (rate-limit guard)
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
      if (!sb) { console.log("No likes left / Select gone. Done."); break; }
      realClick(sb);
      await sleep(1500);
      icons = getIcons();
    }
    if (icons.length === 0) { console.log("No likes left."); break; }

    // Select a batch.
    let sel = 0;
    for (const icon of icons) {
      if (sel >= BATCH) break;
      const btn = icon.closest('[role="button"]');
      if (!btn) continue;
      realClick(btn);
      sel++;
      await sleep(rnd(500, 900));
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

    total += sel;
    cycle++;
    console.log(`Cycle ${cycle}: removed ${sel} | total ${total}/${MAX_TOTAL}`);

    await sleep(rnd(MIN_PAUSE, MAX_PAUSE));
  }

  console.log(`%cStopped. Removed ${total} likes in ${cycle} cycles.`, "color:lime;font-weight:bold");
})();
