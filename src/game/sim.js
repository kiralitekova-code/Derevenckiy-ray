// The farm's clock: time of day, crop growth, construction, animals roaming,
// the overnight change to a new day, and neighbours' orders.
import {
	ANIMALS, BAG_BARN, BAG_BASE, BONUS_HEARTS, BUILDINGS, CROPS, CROP_ORDER, DAY_END, DAY_START, FISH,
	ITEMS, NEIGHBORS, NEIGHBOR_ORDER, NIGHT_BUILD_HOURS, NIGHT_GROWTH_HOURS, SEASONS, WORKERS,
} from "./data.js";
import { rand } from "./state.js";

export function seasonIndex(farm, seasonDays) {
	return Math.floor((farm.day - 1) / seasonDays) % 4;
}
export function seasonOf(farm, seasonDays) {
	return SEASONS[seasonIndex(farm, seasonDays)].id;
}
export function dayInSeason(farm, seasonDays) {
	return ((farm.day - 1) % seasonDays) + 1;
}

export function bagCount(farm) {
	let n = 0;
	for (const v of Object.values(farm.inv)) n += v;
	return n;
}
export function bagCap(farm) {
	return farm.buildings.barn.state === "done" ? BAG_BARN : BAG_BASE;
}

// 0 seed, 1 sprout, 2 growing, 3 ripe; -1 empty.
export function cropStage(plot) {
	if (!plot.crop) return -1;
	const f = plot.growth / CROPS[plot.crop].hours;
	if (f >= 1) return 3;
	if (f >= 0.55) return 2;
	if (f >= 0.18) return 1;
	return 0;
}

export function plotActive(farm, plot) {
	return !plot.gh || farm.buildings.greenhouse.state === "done";
}

function growPlots(farm, hours, season) {
	for (const p of farm.plots) {
		if (!p.crop || !plotActive(farm, p)) continue;
		if (!p.gh && season === "winter") continue; // fields sleep under snow
		const max = CROPS[p.crop].hours;
		if (p.growth >= max) continue;
		p.growth = Math.min(max, p.growth + hours * (p.watered ? 1 : 0.5));
	}
}

function finishBuild(state, id) {
	const farm = state.farm;
	const b = farm.buildings[id];
	const worker = b.worker;
	b.state = "done";
	b.progress = BUILDINGS[id].hours;
	b.worker = null;
	if (worker && farm.workers[worker]) farm.workers[worker].job = null;
	state.fx.push({ type: "built", id });
}

function progressBuilds(state, hours) {
	const farm = state.farm;
	for (const [id, b] of Object.entries(farm.buildings)) {
		if (b.state !== "building") continue;
		b.progress += hours;
		if (b.progress >= BUILDINGS[id].hours) finishBuild(state, id);
	}
}
export { finishBuild };

// Real-time step. cfg: { dayLength, growthSpeed, buildSpeed, seasonDays }
export function tick(state, dt, cfg) {
	const farm = state.farm;
	const hours = (dt * (DAY_END - DAY_START)) / cfg.dayLength;
	farm.hour += hours;
	const season = seasonOf(farm, cfg.seasonDays);
	growPlots(farm, hours * cfg.growthSpeed, season);
	progressBuilds(state, hours * cfg.buildSpeed);
	if (farm.hour >= DAY_END && !state.sleepQueued) {
		state.sleepQueued = true;
		state.queue.push({ type: "sleep", passedOut: true });
	}
	moveAnimals(state, dt);
}

// --- Animals ---------------------------------------------------------------------------
const ANIMAL_SPEED = { chicken: 0.9, cow: 0.55, sheep: 0.7 };

export function penOf(kind) {
	return BUILDINGS[ANIMALS[kind].home].pen;
}

function moveAnimals(state, dt) {
	for (const a of state.farm.animals) {
		const pen = penOf(a.kind);
		if (a.wait > 0) {
			a.wait -= dt;
			a.moving = false;
			continue;
		}
		if (a.tx === undefined) {
			a.tx = pen[0] + Math.random() * (pen[2] - pen[0]);
			a.tz = pen[1] + Math.random() * (pen[3] - pen[1]);
		}
		const dx = a.tx - a.x;
		const dz = a.tz - a.z;
		const d = Math.hypot(dx, dz);
		if (d < 0.1) {
			a.tx = undefined;
			a.wait = 1.5 + Math.random() * 4;
			a.moving = false;
			continue;
		}
		const step = Math.min(d, ANIMAL_SPEED[a.kind] * dt);
		a.x += (dx / d) * step;
		a.z += (dz / d) * step;
		a.face = Math.atan2(dx, dz);
		a.moving = true;
		a.phase = (a.phase || 0) + step * 6;
	}
}

// --- Orders ----------------------------------------------------------------------------
function obtainable(farm, item, season) {
	if (CROPS[item]) return CROPS[item].seasons.includes(season) || farm.buildings.greenhouse.state === "done";
	if (item === "egg") return farm.animals.some((a) => a.kind === "chicken");
	if (item === "milk") return farm.animals.some((a) => a.kind === "cow");
	if (item === "wool") return farm.animals.some((a) => a.kind === "sheep");
	if (item === "flour") return farm.buildings.mill.state === "done";
	if (item === "hay") return true;
	if (FISH[item]) return item !== "goldfish" && FISH[item].seasons.includes(season) && !FISH[item].night;
	return false;
}

const round5 = (v) => Math.max(5, Math.round(v / 5) * 5);

export function makeOrder(farm, npc, season) {
	let wants = NEIGHBORS[npc].wants.filter((i) => obtainable(farm, i, season));
	if (!wants.length) wants = CROP_ORDER.filter((c) => obtainable(farm, c, season));
	if (!wants.length) wants = ["hay"];
	const items = {};
	const kinds = farm.friends[npc] >= 2 && wants.length > 1 && rand(farm) < 0.5 ? 2 : 1;
	let value = 0;
	for (let k = 0; k < kinds; k++) {
		const pool = wants.filter((w) => !items[w]);
		const item = pool[Math.floor(rand(farm) * pool.length)];
		const sell = ITEMS[item].sell;
		const n = Math.max(1, Math.min(item === "hay" ? 8 : 5, Math.round(140 / sell / kinds) + Math.floor(rand(farm) * 2)));
		items[item] = n;
		value += (item === "hay" ? ITEMS.hay.buy : sell) * n;
	}
	const id = `o${farm.nextId++}`;
	return { id, npc, items, reward: round5(value * 1.7 + 15) };
}

export function ensureOrders(farm, season) {
	const busy = new Set(farm.orders.map((o) => o.npc));
	let guard = 0;
	while (farm.orders.length < 3 && guard++ < 20) {
		const free = NEIGHBOR_ORDER.filter((n) => !busy.has(n));
		if (!free.length) break;
		const npc = free[Math.floor(rand(farm) * free.length)];
		busy.add(npc);
		farm.orders.push(makeOrder(farm, npc, season));
	}
}

// --- Overnight -------------------------------------------------------------------------
const SEASON_ARRIVES = { spring: "Пришла весна", summer: "Наступило лето", autumn: "Наступила осень", winter: "Пришла зима" };

export function newDay(state, cfg) {
	const farm = state.farm;
	const events = [];
	const before = seasonOf(farm, cfg.seasonDays);
	growPlots(farm, NIGHT_GROWTH_HOURS * cfg.growthSpeed, before);
	const doneBefore = new Set(Object.keys(farm.buildings).filter((id) => farm.buildings[id].state === "done"));
	progressBuilds(state, NIGHT_BUILD_HOURS * cfg.buildSpeed);
	for (const id of Object.keys(farm.buildings)) {
		if (farm.buildings[id].state === "done" && !doneBefore.has(id)) events.push({ icon: ["BUILD_ICONS", id], text: `${BUILDINGS[id].name}: стройка закончена` });
	}
	farm.day += 1;
	farm.hour = DAY_START;
	const season = seasonOf(farm, cfg.seasonDays);
	if (season !== before) events.push({ icon: null, season, text: SEASON_ARRIVES[season] });

	const rain = season !== "winter" && rand(farm) < 0.18;
	for (const p of farm.plots) p.watered = rain && !p.gh && !!p.crop;
	if (rain) events.push({ icon: null, rain: true, text: "Ночью шёл дождь — грядки политы" });

	const made = {};
	const vika = !!farm.bonuses.vika;
	for (const a of farm.animals) {
		const def = ANIMALS[a.kind];
		if (a.fed) {
			a.days = (a.days || 0) + 1;
			const every = a.kind === "sheep" && vika ? 2 : def.every;
			if (a.days >= every && !a.ready) {
				a.ready = true;
				a.double = vika && rand(farm) < 0.3;
				a.days = 0;
				made[def.product] = (made[def.product] || 0) + (a.double ? 2 : 1);
			}
		}
		a.fed = false;
		a.petted = false;
	}
	for (const [item, n] of Object.entries(made)) events.push({ icon: ITEMS[item].icon, text: `${ITEMS[item].name}: ${n} шт. ждут тебя` });
	const hungry = farm.animals.filter((a) => !a.ready && a.days === 0).length;
	if (farm.animals.length && hungry && !Object.keys(made).length) events.push({ icon: ["ITEM_ICONS", "hay"], text: "Покорми животных, чтобы завтра был урожай" });

	if (farm.bonuses.nyura) {
		const options = CROP_ORDER.filter((c) => CROPS[c].seasons.includes(season));
		if (options.length) {
			const crop = options[Math.floor(rand(farm) * options.length)];
			farm.seeds[crop] = (farm.seeds[crop] || 0) + 2;
			events.push({ icon: ITEMS[crop].icon, text: `Баба Нюра подарила семена: ${CROPS[crop].name} ×2` });
		}
	}
	const had = farm.orders.length;
	ensureOrders(farm, season);
	if (farm.orders.length > had) events.push({ icon: null, order: true, text: `Новых заказов: ${farm.orders.length - had}` });
	const growing = farm.plots.filter((p) => p.crop && cropStage(p) === 3).length;
	if (growing) events.push({ icon: null, ripe: true, text: `Созрело грядок: ${growing}` });
	state.sleepQueued = false;
	return events;
}

export function heartsBonusText(npc) {
	return NEIGHBORS[npc].bonus;
}

export function freeWorker(farm) {
	return Object.keys(WORKERS).find((w) => farm.workers[w].hired && !farm.workers[w].job) || null;
}

export function hasBonus(farm, npc) {
	return !!farm.bonuses[npc] || farm.friends[npc] >= BONUS_HEARTS;
}
