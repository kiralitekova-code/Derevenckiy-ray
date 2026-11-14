// Спрайт-атласы: загрузка и «нарезка» (логическая) на части.
// Каждая часть доступна как CSS-спрайт (background-position) и как отдельный canvas
// (для отрисовки иконок в 3D-барышках над NPC).

import { ATLASES } from "./manifest.js";

export const atlas = {
  images: {},      // id -> HTMLImageElement
  ready: false,
};

function index(id, part) {
  const a = ATLASES[id];
  const i = a.parts.indexOf(part);
  if (i < 0) throw new Error(`Атлас ${id}: нет части "${part}"`);
  return { col: i % a.cols, row: Math.floor(i / a.cols), cols: a.cols, rows: a.rows };
}

// CSS-стиль спрайта для элемента size×size.
export function spriteStyle(id, part, size) {
  const { col, row, cols, rows } = index(id, part);
  return {
    width: size + "px",
    height: size + "px",
    backgroundImage: `url(${ATLASES[id].src})`,
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${(col * 100) / (cols - 1)}% ${(row * 100) / (rows - 1)}%`,
    backgroundRepeat: "no-repeat",
    imageRendering: "auto",
  };
}

export function spriteEl(id, part, size, cls = "") {
  const el = document.createElement("span");
  if (cls) el.className = cls;
  Object.assign(el.style, spriteStyle(id, part, size));
  el.dataset.part = part;
  return el;
}

// Отдельный canvas с вырезанной частью (для текстур/баблов в 3D-сцене).
export function spriteCanvas(id, part) {
  const img = atlas.images[id];
  const a = ATLASES[id];
  const { col, row } = index(id, part);
  const cw = Math.floor(img.width / a.cols), ch = Math.floor(img.height / a.rows);
  const c = document.createElement("canvas");
  c.width = cw; c.height = ch;
  c.getContext("2d").drawImage(img, col * cw, row * ch, cw, ch, 0, 0, cw, ch);
  return c;
}

export function loadAtlases() {
  return Promise.all(Object.entries(ATLASES).map(([id, a]) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { atlas.images[id] = img; res(); };
    img.onerror = () => rej(new Error("Не загрузился атлас: " + a.src));
    img.src = a.src;
  }))).then(() => { atlas.ready = true; });
}
