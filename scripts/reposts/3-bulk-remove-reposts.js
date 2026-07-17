/*
 * Step 3 (reposts) - Bulk remove (loops until the session limit or none left)
 *
 * WARNING: this deletes real data and cannot be undone. Read the code before
 * you run it.
 *
 * KNOWN INSTAGRAM ISSUE (not a bug in this script):
 * Deleting reposts is currently flaky on Instagram's side. With the default
 * "Newest to oldest" order, Instagram often shows a "deleted" toast but the
 * repost stays. This also happens when you delete by hand, so it is not
 * caused by automation. Sorting "Oldest to newest" helps, but Instagram may
 * still rate-limit or fail after a while. If nothing is actually being
 * removed, stop and try again later.
 *
 * Before running: Sort & filter -> "Oldest to newest".
 *
 * The confirm is a React popup that only opens for a click dispatched on the
 * innermost leaf element with a full pointer+mouse sequence (realClick below).
 * The script verifies the selection actually registered before deleting, so a
 * stale/empty selection is not counted as a fake success.
 *
 * Run on: https://www.instagram.com/your_activity/interactions/reposts
 * Stop:   window.__STOP__ = true
 */
(async function bulkRemoveReposts() {
  // ===== settings =====
  const BATCH_MIN   = 4;      // fewest reposts selected per cycle (randomized)
  const BATCH_MAX   = 7;      // most reposts selected per cycle (randomized)
  const SKIP_CHANCE = 0.12;   // chance to skip an item this pass (picked up later)
  const MAX_TOTAL   = 50;     // stop after this many this session
  const MIN_PAUSE   = 18000;
  const MAX_PAUSE   = 30000;
  const LONG_BREAK  = 0.2;    // chance of a longer human-like pause between cycles
  // ====================

  window.__STOP__ = false;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a));
  const ownText = (el) => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join("");

  const realClick = (el) => {
    el.scrollIntoView({ block: "center" });
    const rect = el.getBoundingClientRect();
    const o = {
      bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: 1,
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
      pointerId: 1, pointerType: "mouse", isPrimary: true
    };
    el.dispatchEvent(new PointerEvent("pointerover", o));
    el.dispatchEvent(new PointerEvent("pointerdown", o));
    el.dispatchEvent(new MouseEvent("mousedown", o));
    if (el.focus) el.focus();
    el.dispatchEvent(new PointerEvent("pointerup", o));
    el.dispatchEvent(new MouseEvent("mouseup", o));
    el.dispatchEvent(new MouseEvent("click", o));
  };

  const getIcons = () => [...document.querySelectorAll('div[data-bloks-name="ig.components.Icon"]')]
    .filter(el => (el.getAttribute("style") || "").includes("circle__outline"));
  const countSelected = () => [...document.querySelectorAll('div[data-bloks-name="ig.components.Icon"]')]
    .filter(el => (el.getAttribute("style") || "").includes("circle-check")).length;
  const findSelect = () => [...document.querySelectorAll('span[data-bloks-name="bk.components.Text"]')].find(s => ownText(s) === "Select");
  const findDeleteLeaf = () => [...document.querySelectorAll('span[data-bloks-name="bk.components.TextSpan"]')]
    .find(s => ownText(s) === "Delete" && s.closest('div[role="button"][aria-label="Delete"]'));
  const blocked = () => [...document.querySelectorAll("*")].some(el => /action blocked|try again later|we restrict/i.test(el.innerText || ""));

  const findConfirm = async () => {
    for (let i = 0; i < 15; i++) {
      await sleep(400);
      const cands = [...document.querySelectorAll('div:not([data-bloks-name])')].filter(d => (d.innerText || "").trim() === "Delete");
      if (cands.length) return cands.find(d => !cands.some(o => o !== d && d.contains(o))) || cands[cands.length - 1];
    }
    return null;
  };

  let total = 0, cycle = 0;
  console.log("%cStart. Sort must be Oldest->Newest. Stop with:  window.__STOP__ = true", "color:cyan;font-weight:bold");

  while (!window.__STOP__ && total < MAX_TOTAL) {
    if (blocked()) { console.warn("Action blocked. Stopped. Wait 24-48h."); break; }

    // ensure selection mode
    let icons = getIcons();
    if (!icons.length) {
      const sel = findSelect();
      if (!sel) { console.log("No reposts left / Select gone. Done."); break; }
      realClick(sel);
      await sleep(1800);
      icons = getIcons();
    }
    if (!icons.length) {
      window.scrollBy(0, 1200);
      await sleep(1200);
      icons = getIcons();
      if (!icons.length) { console.log("No reposts left."); break; }
    }

    // select a randomized batch, occasionally skipping an item (human-like)
    const target = rnd(BATCH_MIN, BATCH_MAX + 1);
    let sel = 0;
    for (const icon of icons) {
      if (sel >= target || total + sel >= MAX_TOTAL) break;
      if (Math.random() < SKIP_CHANCE) continue; // skip this one; it stays for a later cycle
      realClick(icon.closest('[role="button"]') || icon);
      sel++;
      await sleep(rnd(450, 1000));
    }
    if (!sel) { console.log("Nothing selectable. Done."); break; }

    // verify the selection actually registered (guards the Instagram issue
    // where a stale selection deletes nothing but still shows a toast)
    await sleep(700);
    const verified = countSelected();
    if (verified === 0) {
      console.warn("Selection did not register (0 checked). Sorted Oldest->Newest? Stopped.");
      break;
    }

    // delete + confirm
    await sleep(800);
    const delLeaf = findDeleteLeaf();
    if (!delLeaf) { console.warn("Delete leaf not found. Stopped."); break; }
    realClick(delLeaf);

    const confirmBtn = await findConfirm();
    if (!confirmBtn) { console.warn("Confirm popup did not open. Stopped."); break; }
    realClick(confirmBtn);
    await sleep(2000);

    total += verified;
    cycle++;
    console.log(`Cycle ${cycle}: removed ${verified} (selected ${sel}) | total ${total}/${MAX_TOTAL}`);

    // vary the pause; now and then take a longer break like a human would
    await sleep(Math.random() < LONG_BREAK ? rnd(MAX_PAUSE, MAX_PAUSE + 40000) : rnd(MIN_PAUSE, MAX_PAUSE));
  }

  console.log(`%cStopped. Removed ${total} reposts in ${cycle} cycles.`, "color:lime;font-weight:bold");
})();
