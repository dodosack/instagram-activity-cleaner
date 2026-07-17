/*
 * Step 1 (reposts) - Diagnose (turns on selection mode, deletes nothing)
 *
 * Clicks "Select" and reports whether the reposts-page selectors still match.
 * It does NOT select or delete anything.
 *
 * Run on: https://www.instagram.com/your_activity/interactions/reposts
 */
(async function diagnoseReposts() {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const ownText = (el) => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join("");
  const realClick = (el) => {
    el.scrollIntoView({ block: "center" });
    const o = { bubbles: true, cancelable: true, view: window, buttons: 1, pointerId: 1, pointerType: "mouse", isPrimary: true };
    el.dispatchEvent(new PointerEvent("pointerdown", o));
    el.dispatchEvent(new MouseEvent("mousedown", o));
    el.dispatchEvent(new PointerEvent("pointerup", o));
    el.dispatchEvent(new MouseEvent("mouseup", o));
    el.dispatchEvent(new MouseEvent("click", o));
  };
  const getIcons = () => [...document.querySelectorAll('div[data-bloks-name="ig.components.Icon"]')]
    .filter(el => (el.getAttribute("style") || "").includes("circle__outline"));

  const selectSpan = [...document.querySelectorAll('span[data-bloks-name="bk.components.Text"]')].find(s => ownText(s) === "Select");
  console.log("=== IG reposts diagnose (read only) ===");
  console.log("Select label found:", !!selectSpan);
  console.log("UI language:", document.documentElement.lang || "unknown");
  console.log("URL:", location.href);
  if (!selectSpan) { console.warn("No Select label. Page still loading, or UI not in English."); return; }

  realClick(selectSpan);
  await sleep(1800);

  const icons = getIcons();
  const delBtn = document.querySelector('div[role="button"][aria-label="Delete"]');
  console.log("Selectable repost icons after Select:", icons.length);
  console.log("Delete control present:", !!delBtn, "(usually appears once something is selected)");
  console.log("If this looks right, run 2-mini-test-3-reposts.js.");
})();
