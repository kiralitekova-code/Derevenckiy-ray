// The one context button: find what the player is facing and what pressing
// the button would do to it. update() calls findTarget each frame and
// performTarget when the button is pressed.
import * as A from "./actions.js";
import { BUILDINGS, NEIGHBORS, NEIGHBOR_ORDER, PIER, SPOTS, WATER_MAX } from "./data.js";
import { plotCenter } from "./state.js";
import { cropStage, plotActive } from "./sim.js";

function rectDist(x, z, b, pad = 0) {
	const dx = Math.max(Math.abs(x - b.x) - b.w / 2 - pad, 0);
	const dz = Math.max(Math.abs(z - b.z) - b.d / 2 - pad, 0);
	return Math.hypot(dx, dz);
}

export function onPier(x, z) {
	return x > PIER.minX && x < PIER.maxX && z > PIER.minZ - 0.4;
}

// npcPos(npc) -> [x, z] (Senya walks to building sites).
export function findTarget(state, npcPos) {
	const farm = state.farm;
	const p = farm.player;
	const fx = p.x + Math.sin(p.face) * 0.8;
	const fz = p.z + Math.cos(p.face) * 0.8;
	const cands = [];
	const addC = (score, t) => cands.push({ score, ...t });

	if (state.placing) {
		return { kind: "place", label: "Поставить", icon: "place", x: state.placing.x, z: state.placing.z, disabled: !state.placing.ok };
	}

	// Plots: the one in front of the player wins ties.
	for (const plot of farm.plots) {
		if (!plotActive(farm, plot)) continue;
		const [x, z] = plotCenter(plot);
		// The plot in front of the player, or the one underfoot when walking a row.
		const dFront = Math.max(Math.abs(fx - x), Math.abs(fz - z));
		const dFeet = Math.max(Math.abs(p.x - x), Math.abs(p.z - z)) + 0.15;
		const d = Math.min(dFront, dFeet);
		if (d > 0.68) continue;
		const base = { kind: "plot", id: plot.id, x, z, ring: 0.62 };
		if (plot.kind === "debris") addC(d, { ...base, label: "Расчистить", icon: "clear" });
		else if (!plot.crop) addC(d, { ...base, label: "Посадить", icon: "seed" });
		else {
			const st = cropStage(plot);
			if (st === 3) addC(d, { ...base, label: "Собрать", icon: "hand" });
			else if (!plot.watered) addC(d, { ...base, label: "Полить", icon: "water", disabled: farm.water <= 0 });
			else addC(d + 1.2, { ...base, label: "Растёт", icon: "sprout", disabled: true });
		}
	}

	// Neighbours.
	for (const npc of NEIGHBOR_ORDER) {
		const [x, z] = npcPos(npc);
		const d = Math.hypot(p.x - x, p.z - z);
		if (d > 1.9) continue;
		const order = farm.orders.find((o) => o.npc === npc);
		const can = order && A.canFulfil(farm, order);
		if (can) addC(d - 0.3, { kind: "deliver", id: npc, x, z, label: "Отдать", icon: "gift" });
		else if (npc === "ashot") addC(d - 0.2, { kind: "shop", id: npc, x, z, label: "Лавка", icon: "shop" });
		else addC(d, { kind: "talk", id: npc, x, z, label: "Говорить", icon: "talk" });
	}
	{
		const d = Math.hypot(p.x - SPOTS.stall[0], p.z - SPOTS.stall[1]);
		if (d < 1.6) addC(d, { kind: "shop", id: "ashot", x: SPOTS.stall[0], z: SPOTS.stall[1], label: "Лавка", icon: "shop" });
	}

	// Animals.
	for (const a of farm.animals) {
		const d = Math.hypot(fx - a.x, fz - a.z);
		if (d > (a.kind === "cow" ? 1.6 : 1.1)) continue;
		const base = { kind: "animal", id: a.id, x: a.x, z: a.z, ring: a.kind === "cow" ? 1.1 : 0.6 };
		if (a.ready) addC(d - 0.2, { ...base, label: "Собрать", icon: "hand" });
		else if (!a.fed) addC(d, { ...base, label: "Покормить", icon: "feed" });
		else if (!a.petted) addC(d, { ...base, label: "Погладить", icon: "heart" });
		else addC(d + 1, { ...base, label: "Сыт", icon: "heart", disabled: true });
	}

	// Crate, door.
	{
		const d = Math.hypot(p.x - SPOTS.crate[0], p.z - (SPOTS.crate[1] - 0.5));
		if (d < 1.7) addC(d, { kind: "crate", x: SPOTS.crate[0], z: SPOTS.crate[1] - 0.5, label: "Продать", icon: "coin", ring: 0.9 });
	}
	{
		const d = Math.hypot(p.x - SPOTS.door[0], p.z - SPOTS.door[1]);
		if (d < 1.4) addC(d, { kind: "sleep", x: SPOTS.door[0], z: SPOTS.door[1] - 0.4, label: "Спать", icon: "moon" });
	}

	// Building lots.
	for (const [id, b] of Object.entries(BUILDINGS)) {
		const d = rectDist(p.x, p.z, b);
		if (d > 1.2) continue;
		const st = farm.buildings[id].state;
		const ring = Math.max(b.w, b.d) * 0.62;
		if (st !== "done") addC(d + 0.4, { kind: "lot", id, x: b.x, z: b.z, label: "Стройка", icon: "hammer", ring });
		else if (id === "mill") addC(d, { kind: "mill", id, x: b.x, z: b.z, label: "Смолоть", icon: "mill", ring });
		else if (id === "well" && farm.water < WATER_MAX) addC(d, { kind: "refill", id, x: b.x, z: b.z, label: "Набрать воды", icon: "water", ring: 1 });
	}

	// Water: the pier's end for fishing, the riverbank for the watering can.
	if (onPier(p.x, p.z) && Math.hypot(p.x - SPOTS.pierEnd[0], p.z - SPOTS.pierEnd[1]) < 1.6) {
		addC(0.2, { kind: "fish", x: SPOTS.pierEnd[0], z: SPOTS.pierEnd[1] + 1.2, label: "Рыбачить", icon: "fish" });
	}
	if (p.z > SPOTS.riverZ && farm.water < WATER_MAX) {
		addC(0.5, { kind: "refill", x: p.x, z: p.z + 0.9, label: "Набрать воды", icon: "water" });
	}

	if (!cands.length) return null;
	cands.sort((a, b) => (a.disabled ? 1 : 0) - (b.disabled ? 1 : 0) || a.score - b.score);
	return cands[0];
}

export function performTarget(state, t, cfg, npcPos) {
	const farm = state.farm;
	if (!t || t.disabled) {
		if (t && t.kind === "plot" && t.icon === "water") A.water(state, farm.plots.find((q) => q.id === t.id));
		else if (t && t.kind === "place") A.placeDecor(state);
		return null;
	}
	switch (t.kind) {
		case "plot": {
			const plot = farm.plots.find((q) => q.id === t.id);
			if (t.label === "Расчистить") A.clearDebris(state, plot);
			else if (t.label === "Посадить") A.plant(state, plot, cfg);
			else if (t.label === "Собрать") A.harvest(state, plot);
			else if (t.label === "Полить") A.water(state, plot);
			return t.label === "Полить" ? "water" : "harvest";
		}
		case "deliver":
			A.deliver(state, t.id, cfg, npcPos(t.id));
			return "wave";
		case "talk":
			A.talk(state, t.id);
			return "wave";
		case "shop":
			state.queue.push({ type: "screen", id: "screen:shop", tab: "buy" });
			return null;
		case "crate":
			state.queue.push({ type: "screen", id: "screen:shop", tab: "sell" });
			return null;
		case "sleep":
			state.queue.push({ type: "sleep" });
			return null;
		case "animal": {
			const a = farm.animals.find((q) => q.id === t.id);
			if (t.label === "Собрать") A.collect(state, a);
			else if (t.label === "Покормить") A.feed(state, a);
			else A.pet(state, a);
			return "harvest";
		}
		case "lot":
			state.queue.push({ type: "screen", id: "screen:build", lot: t.id });
			return null;
		case "mill":
			A.mill(state);
			return "harvest";
		case "refill":
			A.refill(state);
			return "water";
		case "fish":
			state.queue.push({ type: "fish" });
			return null;
		case "place":
			A.placeDecor(state);
			return null;
		default:
			return null;
	}
}

export function npcSpot(npc) {
	return [NEIGHBORS[npc].x, NEIGHBORS[npc].z];
}
