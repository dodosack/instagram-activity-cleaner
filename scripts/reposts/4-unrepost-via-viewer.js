/*
 * Step 4 (reposts) - RECOMMENDED: un-repost via the profile viewer
 *
 * WARNING: this deletes real data and cannot be undone. Read the code before
 * you run it.
 *
 * Why this exists:
 * The "Your activity > Reposts" bulk list (scripts 1-3) is virtualized and
 * deletes unreliably - selecting many often removes only a few (see NOTES.md).
 * This script uses the normal post viewer opened from your profile Reposts tab
 * instead, which is stable.
 *
 * How Instagram's un-repost works here:
 * Clicking the repost icon opens a small popover that says
 *     "You reposted this.  Delete"    (plus an "Add" emoji button)
 * Clicking "Delete" un-reposts the post. This script:
 *   1. clicks the repost icon to open that popover,
 *   2. clicks the "Delete" link next to "You reposted this",
 *   3. clicks "Next" to move to the following post,
 *   4. repeats.
 * "You reposted this" only shows when the post is actually reposted, so if that
 * popover (and its Delete link) is missing the script stops instead of risking
 * a re-repost. It never touches "Add".
 *
 * How to use:
 *   1. Go to  instagram.com/<your_username>/reposts
 *   2. Click the FIRST repost to open it in the viewer (Next arrow visible).
 *   3. Paste this script and press Enter.
 *
 * Start slow: MAX is small on purpose. Reposts rate-limit easily, especially
 * after lots of other deleting the same day.
 * Stop any time:  window.__STOP__ = true
 */
(async function unrepostViaViewer() {
  // ===== settings =====
  const MAX        = 20;    // how many to un-repost this run
  const MIN_PAUSE  = 2500;  // ms between actions (keep it slow)
  const MAX_PAUSE  = 4000;
  const LONG_BREAK = 0.15;  // chance of a longer human-like pause between actions
  // ====================

  window.__STOP__ = false;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a));
  const realClick = (el) => {
    el.scrollIntoView({ block: "center" });
    const o = { bubbles: true, cancelable: true, view: window, buttons: 1, pointerId: 1, pointerType: "mouse", isPrimary: true };
    el.dispatchEvent(new PointerEvent("pointerdown", o));
    el.dispatchEvent(new MouseEvent("mousedown", o));
    el.dispatchEvent(new PointerEvent("pointerup", o));
    el.dispatchEvent(new MouseEvent("mouseup", o));
    el.dispatchEvent(new MouseEvent("click", o));
  };

  const repostSvg = () => document.querySelector('svg[aria-label="Repost"]');

  // the "Delete" link that belongs to the "You reposted this" popover
  const findDeleteLink = () => {
    const dels = [...document.querySelectorAll('span, div, button, a')]
      .filter(el => (el.innerText || "").trim() === "Delete" && el.getBoundingClientRect().width > 0);
    return dels.find(el => {
      let p = el;
      for (let i = 0; i < 8 && p; i++) {
        if ((p.innerText || "").includes("You reposted this")) return true;
        p = p.parentElement;
      }
      return false;
    }) || null;
  };

  const clickNext = () => {
    const svg = document.querySelector('svg[aria-label="Next"]');
    if (!svg) return false;
    realClick(svg.closest('[role="button"]') || svg.closest("button") || svg.parentElement || svg);
    return true;
  };

  let done = 0;
  console.log("%cStart (viewer popover flow). Stop: window.__STOP__ = true", "color:cyan;font-weight:bold");

  while (!window.__STOP__ && done < MAX) {
    // wait for the repost icon to load - reels/videos render slower, so don't
    // give up on the first miss
    let rs = repostSvg();
    for (let i = 0; i < 12 && !rs && !window.__STOP__; i++) {
      await sleep(500);
      rs = repostSvg();
    }
    if (!rs) { console.log("No Repost icon after waiting ~6s - reached the end. Done."); break; }

    // open the popover
    realClick(rs.closest('[role="button"]') || rs.parentElement || rs);
    await sleep(1300);

    const del = findDeleteLink();
    if (!del) {
      console.warn("No 'You reposted this / Delete' popover. Stopping (won't risk a re-repost).");
      break;
    }
    realClick(del);
    await sleep(Math.random() < LONG_BREAK ? rnd(MAX_PAUSE, MAX_PAUSE + 15000) : rnd(MIN_PAUSE, MAX_PAUSE));
    done++;
    console.log(`un-reposted ${done}/${MAX}`);

    if (!clickNext()) { console.log("No Next button - reached the last one. Done."); break; }
    await sleep(Math.random() < LONG_BREAK ? rnd(MAX_PAUSE, MAX_PAUSE + 15000) : rnd(MIN_PAUSE, MAX_PAUSE));
  }

  console.log(`%cStopped. Un-reposted ${done}. Reload your profile to confirm.`, "color:lime;font-weight:bold");
})();
