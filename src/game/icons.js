// Control icons: inline SVG on one 24×24 viewBox, one stroke weight.
// Item, fish, building and portrait art comes from the generated atlases.
import itemFrames from "../../public/generated-assets/item_icons-transparent.frames.json";
import fishFrames from "../../public/generated-assets/fish_icons-transparent.frames.json";
import buildFrames from "../../public/generated-assets/build_icons-transparent.frames.json";
import portraitFrames from "../../public/generated-assets/portraits-transparent.frames.json";

const P = {
	water: '<path d="M12 3c3.5 4.6 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6.4 6-11z"/>',
	seed: '<path d="M12 21v-7"/><path d="M12 14c-4 0-6-3-6-7 4 0 6 3 6 7z"/><path d="M12 12c0-4 2-6 6-6 0 4-2 6-6 6z"/>',
	sprout: '<path d="M12 21v-8"/><path d="M12 13c-3.5 0-5-2.5-5-6 3.5 0 5 2.5 5 6z"/><path d="M12 11c0-3 1.5-5 5-5 0 3-1.5 5-5 5z"/>',
	hand: '<path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11"/><path d="M10 10V5a1.5 1.5 0 0 1 3 0v5"/><path d="M13 10V6a1.5 1.5 0 0 1 3 0v6"/><path d="M16 9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2.5-4a1.5 1.5 0 0 1 2.5-1.6L7 14"/>',
	clear: '<path d="M14 4l6 6"/><path d="M17 7L7 17"/><path d="M4 20l3-3"/><path d="M14 4c-3 0-6 1-8 3l4 4"/>',
	gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18v-3H3z"/><path d="M12 6v14"/><path d="M12 6c-2-3-6-3-6-.5S10 6 12 6zM12 6c2-3 6-3 6-.5S14 6 12 6z"/>',
	shop: '<path d="M4 10v10h16V10"/><path d="M3 10l2-6h14l2 6"/><path d="M3 10c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3"/><path d="M10 20v-5h4v5"/>',
	talk: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/>',
	coin: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5c0-1.4 1.1-2 2.5-2s2.5.6 2.5 1.7c0 2.6-5 1.3-5 3.9 0 1.1 1.1 1.9 2.5 1.9s2.5-.6 2.5-2"/>',
	moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
	sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
	hammer: '<path d="M14 6l4 4"/><path d="M11 5l3-2 7 7-2 3"/><path d="M13 9L4 18l2 2 9-9"/>',
	bag: '<path d="M6 8h12l1 12H5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M9 13h6"/>',
	scroll: '<path d="M7 4h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7"/><path d="M7 4a2 2 0 0 0-2 2v2h4V6a2 2 0 0 0-2-2z"/><path d="M7 8v11a2 2 0 0 1-2 2"/><path d="M11 9h5M11 13h5M11 17h3"/>',
	feed: '<path d="M5 20c0-6 3-10 7-12"/><path d="M12 8c1-3 3-4 6-4 0 3-1 5-4 6"/><path d="M9 12c-1-2-3-3-5-3 0 2 1 4 3 4.5"/><path d="M8.5 16c1.5-1 3.5-1 5 .5"/>',
	heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
	mill: '<path d="M12 12L6 6M12 12l6-6M12 12l6 6M12 12l-6 6"/><path d="M10 21l1-9h2l1 9"/>',
	fish: '<path d="M3 12c3-4 7-5 10-5 3 0 5 2 7 5-2 3-4 5-7 5-3 0-7-1-10-5z"/><path d="M3 12l-1-3M3 12l-1 3"/><path d="M15.5 10.5h.01"/>',
	place: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
	close: '<path d="M6 6l12 12M18 6L6 18"/>',
	soundOn: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
	soundOff: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l4 6M21 9l-4 6"/>',
	rain: '<path d="M7 15a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 6a4 4 0 0 1 0 9z"/><path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2"/>',
	play: '<path d="M8 5l11 7-11 7z"/>',
	check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
	lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
	clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
	worker: '<circle cx="12" cy="9" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/><path d="M7.5 7.5c0-3 2-4.5 4.5-4.5s4.5 1.5 4.5 4.5z"/>',
	star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z"/>',
};

export function svg(name, cls = "ico-svg") {
	return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;
}

const SHEETS = {
	ITEM_ICONS: itemFrames,
	FISH_ICONS: fishFrames,
	BUILD_ICONS: buildFrames,
	PORTRAITS: portraitFrames,
};

// Atlas sizes come from the loaded images (set once at preload).
const dims = {};
const urls = {};
export function registerAtlas(key, url, w, h) {
	dims[key] = { w, h };
	urls[key] = url;
}

function frameOf(key, name) {
	const sheet = SHEETS[key];
	const list = sheet.frames || [];
	return list.find((f) => f.name === name) || null;
}

// A square box that contains the frame's art, uniformly scaled and centred.
// All values are relative to the box, so CSS can size the box freely.
export function atlasIcon(icon, cls = "atlas") {
	if (!icon) return "";
	const [key, name] = icon;
	const f = frameOf(key, name);
	const d = dims[key];
	if (!f || !d) return `<span class="${cls}"></span>`;
	const c = f.content || f.source;
	const m = Math.max(c.w, c.h);
	const bw = d.w / m;
	const bh = d.h / m;
	const offX = -(c.x / m) + (1 - c.w / m) / 2;
	const offY = -(c.y / m) + (1 - c.h / m) / 2;
	const px = bw === 1 ? 0 : (offX / (1 - bw)) * 100;
	const py = bh === 1 ? 0 : (offY / (1 - bh)) * 100;
	return `<span class="${cls}" style="background-image:url('${urls[key]}');background-size:${(bw * 100).toFixed(2)}% ${(bh * 100).toFixed(2)}%;background-position:${px.toFixed(3)}% ${py.toFixed(3)}%"></span>`;
}
