/*
 * Step 2 - Check selection mode (clicks "Select", deletes nothing)
 *
 * Clicks the "Select" button to turn on selection mode, then counts
 * how many like icons are loaded. It does NOT select or unlike anything.
 *
 * Run on: https://www.instagram.com/your_activity/interactions/likes
 */
(async function checkSelectMode() {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const selectBtn = [...document.querySelectorAll('div[data-bloks-name="bk.components.Flexbox"]')]
    .find(el => el.innerText?.trim() === "Select");

  if (!selectBtn) {
    console.warn("Select button not found. Reload the page and try again.");
    return;
  }

  selectBtn.scrollIntoView({ block: "center" });
  ["mousedown", "mouseup", "click"].forEach(t =>
    selectBtn.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, buttons: 1 })));

  console.log("Clicked Select, waiting for icons to load...");
  await sleep(1500);

  const icons = document.querySelectorAll('div[data-bloks-name="ig.components.Icon"][style*="circle__outline"]');
  console.log("Selectable like icons now visible:", icons.length);
  console.log("Scroll down to load more likes. When this works, run 03-mini-test-3-likes.js.");
})();
