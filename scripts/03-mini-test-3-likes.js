/*
 * Step 3 - Mini test (removes 3 likes, no loop)
 *
 * WARNING: this deletes real data. It removes up to 3 likes so you can
 * watch the full flow once before running the bulk script. Unliking
 * cannot be undone automatically.
 *
 * Run on: https://www.instagram.com/your_activity/interactions/likes
 */
(async function miniTest() {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const realClick = (el) => {
    el.scrollIntoView({ block: "center" });
    ["mousedown", "mouseup", "click"].forEach(t =>
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, buttons: 1 })));
  };

  // Make sure selection mode is on.
  let icons = document.querySelectorAll('div[data-bloks-name="ig.components.Icon"][style*="circle__outline"]');
  if (icons.length === 0) {
    const selectBtn = [...document.querySelectorAll('div[data-bloks-name="bk.components.Flexbox"]')]
      .find(el => el.innerText?.trim() === "Select");
    if (!selectBtn) { console.warn("Select button not found. Reload the page."); return; }
    realClick(selectBtn);
    await sleep(1500);
    icons = document.querySelectorAll('div[data-bloks-name="ig.components.Icon"][style*="circle__outline"]');
  }
  console.log("Available icons:", icons.length);

  // Select exactly 3.
  let count = 0;
  for (const icon of icons) {
    if (count >= 3) break;
    const btn = icon.closest('[role="button"]');
    if (!btn) continue;
    realClick(btn);
    count++;
    await sleep(700);
  }
  console.log("Selected:", count);
  if (count === 0) { console.warn("Nothing selectable."); return; }

  // Click "Unlike".
  await sleep(1200);
  const unlikeBtn = [...document.querySelectorAll("span")]
    .find(el => el.innerText?.trim() === "Unlike")?.closest("button, div");
  if (!unlikeBtn) { console.warn("Unlike button not found."); return; }
  realClick(unlikeBtn);
  console.log("Clicked Unlike, waiting for confirm dialog...");

  // Confirm in the modal.
  await sleep(1000);
  const confirmBtn = [...document.querySelectorAll("button")]
    .find(b => b.innerText?.trim() === "Unlike");
  if (!confirmBtn) { console.warn("Confirm button in dialog not found."); return; }
  confirmBtn.focus();
  await sleep(100);
  confirmBtn.click();

  console.log("%cDone: removed 3 likes (test).", "color:lime;font-weight:bold");
})();
