// The run's plain-JSON state: a fresh farm, and the save format.
// Everything the player owns lives here; Three.js objects never do.
import {
	BUILDINGS, DAY_START, FIELD, GREENHOUSE_PLOTS, NEIGHBOR_ORDER, TILE, WATER_MAX, WORKER_ORDER,
} from "./data.js";

export const SAVE_VERSION = 1;

// Deterministic debris layout so every new farm starts the same way.
const DEBRIS = ["weed", "stone", "weed", "stump", "weed", "stone"];

export function plotCenter(plot) {
	if (plot.gh) {
		const b = BUILDINGS.greenhouse;
		const ox = b.x - ((GREENHOUSE_PLOTS.cols - 1) * 1.15) / 2;
		const oz = b.z - ((GREENHOUSE_PLOTS.rows - 1) * 1.15) / 2 + 0.15;
		return [ox + plot.c * 1.15, oz + plot.r * 1.15];
	}
	const ox = FIELD.x - ((FIELD.cols - 1) * TILE) / 2;
	const oz = FIELD.z - ((FIELD.rows - 1) * TILE) / 2;
	return [ox + plot.c * TILE, oz + plot.r * TILE];
}

function makePlots() {
	const plots = [];
	let n = 0;
	for (let r = 0; r < FIELD.rows; r++) {
		for (let c = 0; c < FIELD.cols; c++) {
			// The middle two columns of the two front rows start tilled (6 plots).
			const open = r >= 2 && c >= 1 && c <= 3;
			plots.push({
				id: `p${r}_${c}`, r, c, gh: false,
				kind: open ? "soil" : "debris",
				debris: open ? null : DEBRIS[n++ % DEBRIS.length],
				hits: 0, crop: null, growth: 0, watered: false,
			});
		}
	}
	// Three radishes are ripe on arrival: the first harvest is one tap away.
	for (const id of ["p3_1", "p3_2", "p3_3"]) {
		const p = plots.find((q) => q.id === id);
		p.crop = "radish";
		p.growth = 99;
	}
	for (let r = 0; r < GREENHOUSE_PLOTS.rows; r++) {
		for (let c = 0; c < GREENHOUSE_PLOTS.cols; c++) {
			plots.push({ id: `g${r}_${c}`, r, c, gh: true, kind: "soil", debris: null, hits: 0, crop: null, growth: 0, watered: false });
		}
	}
	return plots;
}

export function freshFarm(startCoins) {
	const buildings = {};
	for (const id of Object.keys(BUILDINGS)) buildings[id] = { state: "none", progress: 0, worker: null };
	const workers = {};
	for (const id of WORKER_ORDER) workers[id] = { hired: id === "senya", job: null };
	const friends = {};
	for (const id of NEIGHBOR_ORDER) friends[id] = 0;
	return {
		v: SAVE_VERSION,
		hero: null,
		coins: startCoins,
		day: 1,
		hour: DAY_START,
		player: { x: 0.4, z: 1.9, face: Math.PI },
		water: WATER_MAX,
		inv: {},
		seeds: { radish: 5 },
		selectedSeed: "radish",
		plots: makePlots(),
		buildings,
		workers,
		animals: [],
		decor: [],
		orders: [{ id: "o1", npc: "nyura", items: { radish: 3 }, reward: 120 }],
		friends,
		bonuses: {},
		journal: {},
		nextId: 2,
		rng: 12345,
		muted: false,
		stats: { harvested: 0, orders: 0, fish: 0 },
	};
}

// Keys copied to and from the save. Transient play state (fishing, panels,
// placement) is never saved.
const SAVED_KEYS = [
	"hero", "coins", "day", "hour", "player", "water", "inv", "seeds", "selectedSeed", "plots",
	"buildings", "workers", "animals", "decor", "orders", "friends", "bonuses", "journal", "nextId",
	"rng", "muted", "stats",
];

export function toSave(farm) {
	const out = { v: SAVE_VERSION };
	for (const k of SAVED_KEYS) out[k] = farm[k];
	return JSON.parse(JSON.stringify(out));
}

// Loaded data is untrusted: start from a fresh farm and take only what fits.
export function fromSave(data, startCoins) {
	const farm = freshFarm(startCoins);
	if (!data || typeof data !== "object" || data.v !== SAVE_VERSION) return farm;
	for (const k of SAVED_KEYS) {
		if (data[k] === undefined) continue;
		if (typeof farm[k] === "object" && farm[k] !== null && !Array.isArray(farm[k]) && typeof data[k] === "object") {
			farm[k] = { ...farm[k], ...data[k] };
		} else farm[k] = data[k];
	}
	if (!Array.isArray(farm.plots) || farm.plots.length !== freshFarm(0).plots.length) farm.plots = freshFarm(0).plots;
	if (!Array.isArray(farm.animals)) farm.animals = [];
	if (!Array.isArray(farm.decor)) farm.decor = [];
	if (!Array.isArray(farm.orders)) farm.orders = [];
	if (!Number.isFinite(farm.coins)) farm.coins = startCoins;
	return farm;
}

// Small deterministic PRNG stored in the state, so a reload replays fairly.
export function rand(farm) {
	farm.rng = (farm.rng * 1103515245 + 12345) % 2147483648;
	return farm.rng / 2147483648;
}
