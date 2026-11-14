// Весь DOM-UI: HUD, джойстик, панели, диалоги, тосты, минигама рыбалки.

import { spriteEl } from "./atlas.js";
import { ITEMS } from "./state.js";

const SVG_PATHS = {
  coin: '<circle cx="12" cy="12" r="9" fill="#f0b428" stroke="#c88a10" stroke-width="2"/><path d="M12 7v10M9.5 9.5h5M9.5 14.5h5" stroke="#c88a10" stroke-width="1.6" fill="none"/>',
  drop: '<path d="M12 3C12 3 5.5 10.5 5.5 15a6.5 6.5 0 0 0 13 0C18.5 10.5 12 3 12 3z" fill="#5ab4f0" stroke="#2f78c4" stroke-width="1.6"/>',
  clock: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 6.5V12l3.5 2" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
  sun: '<circle cx="12" cy="12" r="5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></g>',
  rain: '<path d="M7 15a5 5 0 1 1 .8-9.9A6 6 0 0 1 19 8.5 4 4 0 0 1 18 15z" fill="currentColor" opacity="0.9"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 18l-1 3M12.5 18l-1 3M17 18l-1 3"/></g>',
  backpack: '<path d="M8 7V6a4 4 0 0 1 8 0v1" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="5" y="7" width="14" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M5 12h14" stroke="currentColor" stroke-width="2"/><rect x="10" y="10.5" width="4" height="3" rx="1" fill="currentColor"/>',
  hammer: '<path d="M14 3l7 7-2.5 2.5L15 9l-8.5 8.5a2 2 0 0 1-3-3L12 6l-1.5-1.5z" fill="currentColor"/>',
  fish: '<path d="M3 12s3.5-5 9-5c4 0 7 3 9 5-2 2-5 5-9 5-5.5 0-9-5-9-5z" fill="currentColor"/><circle cx="15.5" cy="11" r="1.1" fill="#fff8ec"/><path d="M3 12l-2-3v6z" fill="currentColor"/>',
  heart: '<path d="M12 20s-7-4.5-9-9c-1.2-2.8.6-6 3.8-6C9 5 10.5 6.5 12 8.5 13.5 6.5 15 5 17.2 5c3.2 0 5 3.2 3.8 6-2 4.5-9 9-9 9z" fill="currentColor" stroke="none"/>',
  hand: '<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-5.5v-1a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0v7.5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6v-2a1.5 1.5 0 0 1 3 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  can: '<path d="M7 10h8l1.5-2h2v4h-2L15 20H7z" fill="currentColor"/><path d="M15 8c2-3 5-3 6-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  seed: '<path d="M12 21c-4 0-7-3-7-7 0-5 4-9 7-11 3 2 7 6 7 11 0 4-3 7-7 7z" fill="currentColor" opacity="0.25"/><path d="M12 21V8M12 12c-2 0-3.5-1.5-3.5-3.5M12 15c2.5 0 4-1.5 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  bed: '<path d="M4 18v-8m0 4h16v4m0-4a3 3 0 0 0-3-3h-6v3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="7.5" cy="11.5" r="1.8" fill="currentColor"/>',
  board: '<rect x="4" y="5" width="16" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8 9h8M8 12.5h8M8 15.5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  book: '<path d="M5 5a2 2 0 0 1 2-2h12v16H7a2 2 0 0 0-2 2z" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M5 19a2 2 0 0 1 2-2h12" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  cart: '<path d="M4 5h2l2.2 10h9.3l2-7H8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="19" r="1.6" fill="currentColor"/><circle cx="16" cy="19" r="1.6" fill="currentColor"/>',
  gift: '<rect x="4" y="10" width="16" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M4 10h16M12 10v10M12 10s-4 0-5-2c-.8-1.6.5-3.5 2.2-3 1.8.5 2.8 5 2.8 5zm0 0s4 0 5-2c.8-1.6-.5-3.5-2.2-3-1.8.5-2.8 5-2.8 5z" fill="none" stroke="currentColor" stroke-width="2"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z" fill="currentColor"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" fill="currentColor"/>',
};

export function svg(name, cls = "ico-svg") {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("class", cls);
  s.innerHTML = SVG_PATHS[name] || "";
  return s;
}

export function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
}

export function itemIcon(itemId, size) {
  const def = ITEMS[itemId];
  if (def && def.atlas) return spriteEl(def.atlas[0], def.atlas[1], size);
  const s = svg("coin");
  s.style.width = s.style.height = size + "px";
  return s;
}

export function buildDom(mount) {
  const root = el("div", "game-root", mount);
  root.style.containerType = "size";
  const surface = el("div", "game-surface", root);
  const canvas = el("canvas", "world-canvas", surface);
  const anchors = el("div", "anchors", surface);

  const hud = el("div", "hud", surface);
  const hudTop = el("div", "hud-top", hud);
  hudTop.style.display = "flex";
  hudTop.style.justifyContent = "space-between";
  hudTop.style.padding = "10px 12px 0";
  const clusterL = el("div", "hud-cluster", hudTop);
  const clusterR = el("div", "hud-cluster right", hudTop);

  const coins = el("div", "pill coins", clusterL);
  const coinIco = spriteEl("items", "coin", 22);
  coinIco.className = "coin-ico";
  coins.appendChild(coinIco);
  const coinSpan = el("span", "", coins);
  coinSpan.textContent = "150";
  const water = el("div", "pill water", clusterL);
  water.appendChild(svg("drop"));
  const waterSpan = el("span", "", water);
  waterSpan.textContent = "9/12";
  const clock = el("div", "pill clock", clusterR);
  clock.appendChild(svg("clock"));
  const clockDay = el("span", "clock-day", clock);
  const clockTime = el("span", "clock-time", clock);
  const rainBtn = el("button", "pill-btn rain-btn", clusterR);
  rainBtn.appendChild(svg("rain", "ico-svg small"));
  el("span", "", rainBtn).textContent = "Дождь: реклама";
  rainBtn.style.display = "none";

  const joyZone = el("div", "joy-zone", surface);
  const joy = el("div", "joy", joyZone);
  const knob = el("div", "knob", joy);

  const controls = el("div", "controls", surface);
  const sideBtns = el("div", "side-btns", controls);
  const bagBtn = el("button", "round-btn", sideBtns);
  bagBtn.appendChild(svg("backpack"));
  const bagDot = el("span", "dot hidden", bagBtn);
  const diaryBtn = el("button", "round-btn", sideBtns);
  diaryBtn.appendChild(svg("fish"));
  const buildBtn = el("button", "round-btn", sideBtns);
  buildBtn.appendChild(svg("hammer"));
  const actionCol = el("div", "action-col", controls);
  const seedChip = el("button", "seed-chip", actionCol);
  const actionBtn = el("button", "action-btn", actionCol);
  const actionIco = el("span", "action-ico", actionBtn);
  const actionLabel = el("div", "action-label", actionCol);

  const toastZone = el("div", "toast-zone", surface);

  return {
    root, surface, canvas, anchors, hud, clusterL, clusterR,
    coins, coinSpan, water, waterSpan, clock, clockDay, clockTime, rainBtn,
    joyZone, joy, knob, controls, sideBtns, bagBtn, bagDot, diaryBtn, buildBtn,
    actionCol, seedChip, actionBtn, actionIco, actionLabel, toastZone,
    panelLayer: null,
  };
}

export const toastQueue = [];

export function toast(dom, text, kind = "", ms = 2600) {
  const t = el("div", "toast" + (kind ? " " + kind : ""), dom.toastZone);
  t.textContent = text;
  toastQueue.push({ el: t, ttl: ms / 1000 });
}

export function openPanel(dom, cls, build) {
  closePanel(dom);
  const layer = el("div", "panel-layer", dom.surface);
  const panel = el("div", "panel " + cls, layer);
  dom.panelLayer = layer;
  const head = el("div", "panel-head", panel);
  const h2 = el("h2", "", head);
  const closeBtn = el("button", "icon-btn", head);
  closeBtn.appendChild(svg("close"));
  closeBtn.addEventListener("click", () => closePanel(dom));
  const body = el("div", "panel-body", panel);
  build(body, panel, h2);
  return { layer, panel, body, h2 };
}

export function closePanel(dom) {
  if (dom.panelLayer) { dom.panelLayer.remove(); dom.panelLayer = null; }
}

export function rowIco(parent, itemId, size = 44) {
  const holder = el("span", "row-ico", parent);
  holder.style.display = "grid";
  holder.style.placeItems = "center";
  holder.appendChild(itemIcon(itemId, size));
  return holder;
}
