// What the player can do. Each action changes state.farm directly and pushes
// feedback into state.fx (sounds, particles, floating labels, toasts), which
// the game turns into effects. update() calls these when it handles input.
import {
	ANIMALS, BONUS_HEARTS, BUILDINGS, CROPS, DECOR, HEARTS_MAX, ITEMS, NEIGHBORS, WATER_MAX, WORKERS,
} from "./data.js";
import { plotCenter } from "./state.js";
import { bagCap, bagCount, cropStage, ensureOrders, finishBuild, freeWorker, penOf, seasonOf } from "./sim.js";

const SEASON_PREP = { spring: "весной", summer: "летом", autumn: "осенью", winter: "зимой" };

function toast(state, text, tone = "info") {
	state.fx.push({ type: "toast", text, tone });
}
function sfx(state, name) {
	state.fx.push({ type: "sfx", name });
}
function float(state, x, z, text, icon = null, y = 1.4) {
	state.fx.push({ type: "float", x, z, y, text, icon });
}
function burst(state, x, z, kind, n = 10, y = 0.3) {
	state.fx.push({ type: "burst", x, z, y, kind, n });
}

export function shopPrice(farm, base) {
	return farm.bonuses.ashot ? Math.round(base * 0.9) : base;
}
export function buildPrice(farm, id) {
	const base = BUILDINGS[id].cost;
	return farm.bonuses.senya ? Math.round(base * 0.8) : base;
}

function bagRoom(state, n) {
	if (bagCount(state.farm) + n <= bagCap(state.farm)) return true;
	toast(state, "Рюкзак полон — продай что-нибудь в ящике у дома", "warn");
	sfx(state, "deny");
	return false;
}

function add(farm, item, n) {
	farm.inv[item] = (farm.inv[item] || 0) + n;
}
function take(farm, item, n) {
	farm.inv[item] = (farm.inv[item] || 0) - n;
	if (farm.inv[item] <= 0) delete farm.inv[item];
}

// --- Field --------------------------------------------------------------------------
const HITS = { weed: 1, stone: 2, stump: 3 };

export function clearDebris(state, plot) {
	plot.hits += 1;
	const [x, z] = plotCenter(plot);
	burst(state, x, z, plot.debris === "weed" ? "leaf" : plot.debris === "stone" ? "stone" : "wood", 8);
	sfx(state, plot.debris === "weed" ? "dig" : "chop");
	if (plot.hits >= HITS[plot.debris]) {
		plot.kind = "soil";
		plot.debris = null;
		plot.hits = 0;
		burst(state, x, z, "dirt", 10);
		float(state, x, z, "Новая грядка", null, 1);
	}
	state.shake = 0.12;
}

export function plant(state, plot, cfg) {
	const farm = state.farm;
	const crop = farm.selectedSeed;
	if (!crop || !(farm.seeds[crop] > 0)) {
		toast(state, "Нет семян — купи их в лавке Ашота", "warn");
		sfx(state, "deny");
		state.queue.push({ type: "screen", id: "screen:bag" });
		return;
	}
	const season = seasonOf(farm, cfg.seasonDays);
	if (!plot.gh && !CROPS[crop].seasons.includes(season)) {
		toast(state, `${CROPS[crop].name} не сажают ${SEASON_PREP[season]}`, "warn");
		sfx(state, "deny");
		state.queue.push({ type: "screen", id: "screen:bag" });
		return;
	}
	farm.seeds[crop] -= 1;
	if (farm.seeds[crop] <= 0) delete farm.seeds[crop];
	plot.crop = crop;
	plot.growth = 0;
	const [x, z] = plotCenter(plot);
	burst(state, x, z, "dirt", 8);
	sfx(state, "dig");
	if (!farm.seeds[crop]) {
		const next = Object.keys(farm.seeds).find((c) => farm.seeds[c] > 0);
		farm.selectedSeed = next || crop;
	}
}

export function water(state, plot) {
	const farm = state.farm;
	if (farm.water <= 0) {
		toast(state, "Лейка пуста — набери воды у реки", "warn");
		sfx(state, "deny");
		return;
	}
	farm.water -= 1;
	plot.watered = true;
	const [x, z] = plotCenter(plot);
	burst(state, x, z, "drop", 12, 0.6);
	sfx(state, "water");
}

export function harvest(state, plot) {
	const farm = state.farm;
	const def = CROPS[plot.crop];
	if (!bagRoom(state, def.yield)) return;
	add(farm, plot.crop, def.yield);
	const [x, z] = plotCenter(plot);
	float(state, x, z, `+${def.yield}`, ITEMS[plot.crop].icon);
	burst(state, x, z, "spark", 10, 0.5);
	sfx(state, "harvest");
	farm.stats.harvested += def.yield;
	plot.crop = null;
	plot.growth = 0;
	if (farm.stats.harvested === def.yield) state.fx.push({ type: "first", what: "harvest" });
}

export function refill(state) {
	state.farm.water = WATER_MAX;
	const p = state.farm.player;
	burst(state, p.x + Math.sin(p.face) * 0.8, p.z + Math.cos(p.face) * 0.8, "drop", 14, 0.2);
	float(state, p.x, p.z, `Вода ${WATER_MAX}/${WATER_MAX}`, null, 2.1);
	sfx(state, "splash");
}

// --- Animals ------------------------------------------------------------------------
export function feed(state, animal) {
	const farm = state.farm;
	const food = farm.inv.hay ? "hay" : farm.inv.wheat ? "wheat" : null;
	if (!food) {
		toast(state, "Нужно сено или пшеница — сено продаёт Ашот", "warn");
		sfx(state, "deny");
		return;
	}
	take(farm, food, 1);
	animal.fed = true;
	animal.petted = true;
	burst(state, animal.x, animal.z, "heart", 6, 1);
	float(state, animal.x, animal.z, "Сыт!", ITEMS[food].icon, 1.5);
	sfx(state, animal.kind === "chicken" ? "cluck" : animal.kind === "cow" ? "moo" : "baa");
}

export function pet(state, animal) {
	animal.petted = true;
	burst(state, animal.x, animal.z, "heart", 6, 1);
	sfx(state, animal.kind === "chicken" ? "cluck" : animal.kind === "cow" ? "moo" : "baa");
}

export function collect(state, animal) {
	const farm = state.farm;
	const product = ANIMALS[animal.kind].product;
	const n = animal.double ? 2 : 1;
	if (!bagRoom(state, n)) return;
	add(farm, product, n);
	animal.ready = false;
	animal.double = false;
	float(state, animal.x, animal.z, `+${n}`, ITEMS[product].icon, 1.6);
	burst(state, animal.x, animal.z, "spark", 10, 0.8);
	sfx(state, "harvest");
}

// --- Neighbours -------------------------------------------------------------------------
export function canFulfil(farm, order) {
	return Object.entries(order.items).every(([item, n]) => (farm.inv[item] || 0) >= n);
}

export function deliver(state, npc, cfg, at) {
	const farm = state.farm;
	const order = farm.orders.find((o) => o.npc === npc);
	if (!order || !canFulfil(farm, order)) return;
	for (const [item, n] of Object.entries(order.items)) take(farm, item, n);
	farm.coins += order.reward;
	farm.orders = farm.orders.filter((o) => o !== order);
	farm.stats.orders += 1;
	const before = farm.friends[npc];
	farm.friends[npc] = Math.min(HEARTS_MAX, before + 1);
	float(state, at[0], at[1], `+${order.reward}`, ["ITEM_ICONS", "coin"], 2.2);
	burst(state, at[0], at[1], "coin", 14, 1.6);
	burst(state, at[0], at[1], "heart", 5, 2);
	sfx(state, "coin");
	if (before < BONUS_HEARTS && farm.friends[npc] >= BONUS_HEARTS && !farm.bonuses[npc]) {
		farm.bonuses[npc] = true;
		toast(state, `${NEIGHBORS[npc].name}: ${NEIGHBORS[npc].bonus}!`, "gift");
		sfx(state, "fanfare");
	} else toast(state, `${NEIGHBORS[npc].name} благодарит! Дружба ${"♥".repeat(farm.friends[npc])}`, "good");
	state.fx.push({ type: "wave", npc });
	ensureOrders(farm, seasonOf(farm, cfg.seasonDays));
}

export function talk(state, npc) {
	const farm = state.farm;
	const order = farm.orders.find((o) => o.npc === npc);
	if (order) {
		const need = Object.entries(order.items).map(([i, n]) => `${ITEMS[i].name} ${Math.min(farm.inv[i] || 0, n)}/${n}`).join(", ");
		toast(state, `${NEIGHBORS[npc].name}: «Принеси мне — ${need}»`);
	} else {
		const lines = {
			nyura: "Ох, внучок, дед Иван бы тобой гордился!",
			ashot: "Заходи в лавку, дорогой, всё свежее!",
			senya: "Если что построить — зови, я мигом!",
			vika: "Животные любят, когда их гладят.",
			fil: "Сом клюёт только ночью, запомни.",
		};
		toast(state, `${NEIGHBORS[npc].name}: «${lines[npc]}»`);
	}
	state.fx.push({ type: "wave", npc });
	sfx(state, "blip");
}

// --- Shop ---------------------------------------------------------------------------
export function buySeed(state, crop, n) {
	const farm = state.farm;
	const cost = shopPrice(farm, CROPS[crop].seed) * n;
	if (farm.coins < cost) return notEnough(state);
	farm.coins -= cost;
	farm.seeds[crop] = (farm.seeds[crop] || 0) + n;
	farm.selectedSeed = crop;
	sfx(state, "coin");
}

export function buyHay(state, n) {
	const farm = state.farm;
	const cost = shopPrice(farm, ITEMS.hay.buy) * n;
	if (farm.coins < cost) return notEnough(state);
	if (!bagRoom(state, n)) return;
	farm.coins -= cost;
	add(farm, "hay", n);
	sfx(state, "coin");
}

export function animalRoom(farm, kind) {
	const home = ANIMALS[kind].home;
	if (farm.buildings[home].state !== "done") return 0;
	return BUILDINGS[home].capacity - farm.animals.filter((a) => a.kind === kind).length;
}

export function buyAnimal(state, kind) {
	const farm = state.farm;
	if (animalRoom(farm, kind) <= 0) return;
	const cost = shopPrice(farm, ANIMALS[kind].price);
	if (farm.coins < cost) return notEnough(state);
	farm.coins -= cost;
	const pen = penOf(kind);
	const a = {
		id: `a${farm.nextId++}`, kind,
		x: (pen[0] + pen[2]) / 2, z: (pen[1] + pen[3]) / 2, face: 0,
		fed: false, petted: false, ready: false, days: 0,
	};
	farm.animals.push(a);
	burst(state, a.x, a.z, "heart", 8, 1);
	toast(state, `${ANIMALS[kind].name} уже на ферме!`, "good");
	sfx(state, kind === "chicken" ? "cluck" : kind === "cow" ? "moo" : "baa");
}

export function sell(state, item, n) {
	const farm = state.farm;
	const have = farm.inv[item] || 0;
	const k = Math.min(have, n);
	if (k <= 0) return;
	take(farm, item, k);
	farm.coins += ITEMS[item].sell * k;
	sfx(state, "coin");
	state.fx.push({ type: "coinsUp", amount: ITEMS[item].sell * k });
}

export function sellAll(state) {
	const farm = state.farm;
	let total = 0;
	for (const [item, n] of Object.entries(farm.inv)) {
		if (item === "hay") continue; // keep feed
		total += ITEMS[item].sell * n;
		delete farm.inv[item];
	}
	if (!total) return;
	farm.coins += total;
	sfx(state, "coin");
	state.fx.push({ type: "coinsUp", amount: total });
}

function notEnough(state) {
	toast(state, "Не хватает монет", "warn");
	sfx(state, "deny");
}

// --- Construction ---------------------------------------------------------------------
export function startBuild(state, id) {
	const farm = state.farm;
	const b = farm.buildings[id];
	if (b.state !== "none") return;
	const worker = freeWorker(farm);
	if (!worker) {
		toast(state, "Все рабочие заняты — найми ещё одного", "warn");
		sfx(state, "deny");
		return;
	}
	const cost = buildPrice(farm, id);
	if (farm.coins < cost) return notEnough(state);
	farm.coins -= cost;
	b.state = "building";
	b.progress = 0;
	b.worker = worker;
	farm.workers[worker].job = id;
	toast(state, `${WORKERS[worker].name} взялся за дело: ${BUILDINGS[id].name}`, "good");
	sfx(state, "hammer");
	burst(state, BUILDINGS[id].x, BUILDINGS[id].z, "wood", 14, 0.6);
}

export function rushBuild(state, id) {
	const b = state.farm.buildings[id];
	if (b.state === "building") finishBuild(state, id);
}

export function hire(state, id) {
	const farm = state.farm;
	if (farm.workers[id].hired) return;
	const cost = WORKERS[id].price;
	if (farm.coins < cost) return notEnough(state);
	farm.coins -= cost;
	farm.workers[id].hired = true;
	toast(state, `${WORKERS[id].name} теперь работает на тебя`, "good");
	sfx(state, "coin");
}

export function buyDecor(state, kind) {
	const farm = state.farm;
	const cost = DECOR[kind].price;
	if (farm.coins < cost) return notEnough(state);
	farm.coins -= cost;
	state.placing = { kind, rot: 0, ok: false, x: 0, z: 0 };
	state.queue.push({ type: "screen", id: null });
	toast(state, "Выбери место и нажми «Поставить»");
}

export function placeDecor(state) {
	const farm = state.farm;
	const pl = state.placing;
	if (!pl || !pl.ok) {
		toast(state, "Здесь не поставить", "warn");
		sfx(state, "deny");
		return;
	}
	farm.decor.push({ id: `d${farm.nextId++}`, kind: pl.kind, x: pl.x, z: pl.z, rot: pl.rot });
	burst(state, pl.x, pl.z, "spark", 10, 0.4);
	sfx(state, "place");
	state.placing = null;
}

export function cancelPlacing(state) {
	if (!state.placing) return;
	state.farm.coins += DECOR[state.placing.kind].price;
	state.placing = null;
}

export function mill(state) {
	const farm = state.farm;
	if ((farm.inv.wheat || 0) < 3) {
		toast(state, "Нужно 3 пшеницы, чтобы смолоть муку", "warn");
		sfx(state, "deny");
		return;
	}
	take(farm, "wheat", 3);
	add(farm, "flour", 1);
	state.millSpin = 2.5;
	const b = BUILDINGS.mill;
	float(state, b.x, b.z + 1.5, "+1", ITEMS.flour.icon, 2);
	burst(state, b.x, b.z + 1.5, "flour", 12, 1);
	sfx(state, "harvest");
}

// The ad reward: warm rain waters every plot and nudges growth.
export function warmRain(state) {
	for (const p of state.farm.plots) {
		if (!p.crop) continue;
		p.watered = true;
		if (cropStage(p) < 3) p.growth = Math.min(CROPS[p.crop].hours, p.growth + 4);
	}
	state.rainT = 4;
	toast(state, "Тёплый дождь полил все грядки!", "good");
	sfx(state, "water");
}
