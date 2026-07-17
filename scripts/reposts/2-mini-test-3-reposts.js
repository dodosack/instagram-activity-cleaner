/*
 * Step 2 (reposts) - Mini test (removes up to 3 reposts, no loop)
 *
 * WARNING: this deletes real data and cannot be undone.
 *
 * The repost confirm is a React popup that only opens for a click dispatched
 * on the innermost leaf element with a full pointer+mouse sequence - that is
 * what realClick() does here.
 *
 * IMPORTANT: sort the list "Oldest to newest" first (Sort & filter). See the
 * note in 3-bulk-remove-reposts.js.
 *
 * Run on: https://www.instagram.com/your_activity/interactions/reposts
 */
(async function miniTestReposts() {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
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

  // selection mode
  let icons = getIcons();
  if (!icons.length) {
    const sel = [...document.querySelectorAll('span[data-bloks-name="bk.components.Text"]')].find(s => ownText(s) === "Select");
    if (!sel) { console.warn("Select not found."); return; }
    realClick(sel);
    await sleep(1800);
    icons = getIcons();
  }
  if (!icons.length) { console.warn("No reposts."); return; }

  // select up to 3
  let sel = 0;
  for (const icon of icons) {
    if (sel >= 3) break;
    realClick(icon.closest('[role="button"]') || icon);
    sel++;
    await sleep(600);
  }
  console.log("selected:", sel);

  // click the Delete leaf span (not the container)
  await sleep(800);
  const delLeaf = [...document.querySelectorAll('span[data-bloks-name="bk.components.TextSpan"]')]
    .find(s => ownText(s) === "Delete" && s.closest('div[role="button"][aria-label="Delete"]'));
  if (!delLeaf) { console.warn("Delete leaf not found."); return; }
  realClick(delLeaf);

  // confirm: a non-bloks div whose text is "Delete"
  let confirmBtn = null;
  for (let i = 0; i < 15; i++) {
    await sleep(400);
    const cands = [...document.querySelectorAll('div:not([data-bloks-name])')].filter(d => (d.innerText || "").trim() === "Delete");
    if (cands.length) { confirmBtn = cands.find(d => !cands.some(o => o !== d && d.contains(o))) || cands[cands.length - 1]; break; }
  }
  if (!confirmBtn) { console.warn("Confirm popup did not open."); return; }
  realClick(confirmBtn);
  await sleep(1500);

  console.log("Done: removed up to 3 reposts (test). Check they are actually gone.");
})();
