// Fishing at the pier: cast → wait → bite (tap in time) → reel (tap while the
// marker is inside the green zone) → result. One tap verb, timing decides.
import { FISH, ITEMS } from "./data.js";
import { rand } from "./state.js";
import { bagCap, bagCount, seasonOf } from "./sim.js";

const BITE_WINDOW = 1.2;

function pickFish(farm, season, hour) {
	const h = hour % 24;
	const night = h >= 20 || h < 6;
	const pool = Object.entries(FISH).filter(([, f]) => f.seasons.includes(season) && (!f.night || night));
	const total = pool.reduce((s, [, f]) => s + f.weight, 0);
	let r = rand(farm) * total;
	for (const [id, f] of pool) {
		r -= f.weight;
		if (r <= 0) return id;
	}
	return pool[0][0];
}

export function startFishing(state) {
	state.fishing = { phase: "cast", t: 0, wait: 1.6 + rand(state.farm) * 3.2, fish: null, marker: 0, dir: 1, zone: 0, zoneW: 0, speed: 1, result: null };
	state.fx.push({ type: "sfx", name: "whoosh" });
}

export function tapFishing(state, cfg) {
	const f = state.fishing;
	if (!f) return;
	const farm = state.farm;
	if (f.phase === "cast" || f.phase === "wait") {
		state.fishing = null;
		return;
	}
	if (f.phase === "bite") {
		const season = seasonOf(farm, cfg.seasonDays);
		const id = pickFish(farm, season, farm.hour);
		const def = FISH[id];
		f.fish = id;
		f.phase = "reel";
		f.t = 0;
		f.marker = 0;
		f.dir = 1;
		f.speed = def.speed;
		const rod = farm.bonuses.fil ? 1.4 : 1;
		f.zoneW = Math.min(0.6, def.zone * rod * cfg.fishZone);
		f.zone = 0.15 + rand(farm) * (0.85 - f.zoneW - 0.15);
		state.fx.push({ type: "sfx", name: "splash" });
		return;
	}
	if (f.phase === "reel") {
		const inZone = f.marker >= f.zone && f.marker <= f.zone + f.zoneW;
		f.phase = "result";
		f.t = 0;
		if (inZone) {
			if (bagCount(farm) + 1 > bagCap(farm)) {
				f.result = "full";
				state.fx.push({ type: "toast", text: "Рюкзак полон — рыбу пришлось отпустить", tone: "warn" });
				return;
			}
			farm.inv[f.fish] = (farm.inv[f.fish] || 0) + 1;
			const first = !farm.journal[f.fish];
			farm.journal[f.fish] = (farm.journal[f.fish] || 0) + 1;
			farm.stats.fish += 1;
			f.result = "caught";
			f.first = first;
			state.fx.push({ type: "sfx", name: f.fish === "goldfish" ? "fanfare" : "catch" });
			state.fx.push({ type: "burst", x: -0.4, z: 16.6, y: 0, kind: "drop", n: 16 });
			if (first) state.fx.push({ type: "toast", text: `Новая рыба в дневнике: ${ITEMS[f.fish].name}!`, tone: "gift" });
		} else {
			f.result = "escaped";
			state.fx.push({ type: "sfx", name: "splash" });
		}
		return;
	}
	if (f.phase === "result" && f.t > 0.5) state.fishing = null;
}

export function updateFishing(state, dt) {
	const f = state.fishing;
	if (!f) return;
	f.t += dt;
	if (f.phase === "cast" && f.t > 0.6) {
		f.phase = "wait";
		f.t = 0;
		state.fx.push({ type: "sfx", name: "plop" });
	} else if (f.phase === "wait" && f.t >= f.wait) {
		f.phase = "bite";
		f.t = 0;
		state.fx.push({ type: "sfx", name: "splash" });
		state.fx.push({ type: "haptic", ms: 40 });
	} else if (f.phase === "bite" && f.t > BITE_WINDOW) {
		f.phase = "result";
		f.result = "missed";
		f.t = 0;
	} else if (f.phase === "reel") {
		f.marker += f.dir * f.speed * dt;
		if (f.marker >= 1) { f.marker = 1; f.dir = -1; }
		if (f.marker <= 0) { f.marker = 0; f.dir = 1; }
	} else if (f.phase === "result" && f.t > 2.2) {
		state.fishing = null;
	}
}
