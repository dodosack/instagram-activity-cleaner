/*
 * Step 2 (story replies) - Mini test (deletes 3, no loop)
 *
 * WARNING: this deletes real data and cannot be undone. It removes up to 3
 * story replies so you can watch the flow once.
 *
 * Same flow as the comments scripts (Select -> pick items -> Delete -> confirm).
 *
 * Run on: https://www.instagram.com/your_activity/interactions/story_replies
 */
(async function miniTestStoryReplies() {
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
    icon.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(400);
    const btn = icon.closest('[role="button"]');
    if (!btn) continue;
    realClick(btn);
    count++;
    await sleep(700);
  }
  console.log("Selected:", count);
  if (count === 0) { console.warn("Nothing selectable."); return; }

  // Click the Bloks "Delete" control (the text span is not clickable, its
  // pointer-events container is).
  await sleep(1200);
  const deleteSpan = [...document.querySelectorAll('span[data-bloks-name="bk.components.TextSpan"]')]
    .find(s => s.innerText?.trim() === "Delete");
  const deleteBtn = deleteSpan?.closest('div[style*="pointer-events: auto"]');
  if (!deleteBtn) { console.warn("Delete control not found."); return; }
  realClick(deleteBtn);
  console.log("Clicked Delete, waiting for confirm dialog...");

  // Confirm in the modal.
  await sleep(1500);
  const confirmBtn = [...document.querySelectorAll("button")]
    .find(b => b.innerText?.trim() === "Delete");
  if (!confirmBtn) { console.warn("Confirm button in dialog not found."); return; }
  confirmBtn.focus();
  await sleep(100);
  confirmBtn.click();

  console.log("%cDone: deleted 3 story replies (test).", "color:lime;font-weight:bold");
})();
