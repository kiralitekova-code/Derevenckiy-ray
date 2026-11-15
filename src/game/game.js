// Деревенский Рай: Наследие — the game's spine. createGame wires the modules
// together and returns the run's state and the init/update/render hooks the
// SDK loop drives. Game time flows only through update's dt.
import * as A from "./actions.js";
import { createAudio } from "./audio.js";
import { loadModels } from "./actors.js";
import {
	BOUNDS, BUILDINGS, DECOR, NEIGHBORS, NEIGHBOR_ORDER, PIER, SPOTS, WORKER_IDLE,
} from "./data.js";
import { startFishing, tapFishing, updateFishing } from "./fishing.js";
import { createFx } from "./fx.js";
import { createHud } from "./hud.js";
import { registerAtlas } from "./icons.js";
import { createInput } from "./input.js";
import { findTarget, performTarget } from "./interact.js";
import { createScene } from "./scene.js";
import { ensureOrders, newDay, seasonOf, tick } from "./sim.js";
import { freshFarm, fromSave, plotCenter, toSave } from "./state.js";
import { createWorld } from "./world.js";

const ATLASES = ["ITEM_ICONS", "FISH_ICONS", "BUILD_ICONS", "PORTRAITS"];
const PLAYER_R = 0.35;

export function createGame({ mount, sdk, tweaks, assets }) {
	const state = {
		farm: freshFarm(150),
		screen: null,
		ui: { tab: null, lot: null },
		queue: [],
		fx: [],
		input: { mx: 0, mz: 0, kx: 0, kz: 0, actionHeld: false, touched: false },
		anim: { walk: 0, phase: 0, action: null, actionT: 0 },
		target: null,
		fishing: null,
		placing: null,
		adPending: false,
		shake: 0,
		millSpin: 0,
		rainT: 0,
		waves: {},
		recap: null,
		recapPassedOut: false,
		sleepQueued: false,
		time: 0,
	};

	const cfg = {
		get dayLength() { return Number(tweaks.get("dayLength")); },
		get seasonDays() { return Number(tweaks.get("seasonDays")); },
		get growthSpeed() { return Number(tweaks.get("growthSpeed")); },
		get buildSpeed() { return Number(tweaks.get("buildSpeed")); },
		get walkSpeed() { return Number(tweaks.get("walkSpeed")); },
		get fishZone() { return Number(tweaks.get("fishZone")); },
		get zoom() { return Number(tweaks.get("cameraZoom")); },
		get startCoins() { return Number(tweaks.get("startCoins")); },
	};

	// Instance state (not part of the run): the last saved farm, views, devices.
	let savedFarm = null;
	let firstInit = true;
	let world = null;
	let view = null;
	let fx = null;
	let hud = null;
	let input = null;
	let saveTimer = 0;
	let dirty = false;
	let holdCooldown = 0;
	let needResize = true;
	let lastRenderTime = 0;
	let runRef = null;
	const audio = createAudio(sdk);
	const unsubscribes = [];

	// --- Startup -----------------------------------------------------------------------
	const root = document.createElement("div");
	root.className = "game-root";
	mount.replaceChildren(root);
	const loading = document.createElement("div");
	loading.className = "loading";
	loading.innerHTML = `<div class="loading-card"><div class="loading-sprout"></div><span>Едем в Берёзовку…</span></div>`;
	root.appendChild(loading);

	async function preload() {
		const images = Promise.all(ATLASES.map((key) => new Promise((resolve, reject) => {
			const url = assets.get(key);
			const img = new Image();
			img.onload = () => { registerAtlas(key, url, img.naturalWidth, img.naturalHeight); resolve(); };
			img.onerror = () => { console.error(`[farm] image failed to load: ${key}`); reject(new Error(key)); };
			img.src = url;
		})));
		const save = sdk.gameState.load().catch(() => null);
		const [models, , saved] = await Promise.all([loadModels(assets), images, save]);
		if (saved && saved.v) savedFarm = fromSave(saved, cfg.startCoins);

		world = createWorld(root);
		view = createScene(world, models);
		fx = createFx(world.scene);
		hud = createHud(root, state, { onAd: requestAd });
		input = createInput({ stage: root, joy: hud.el.joy, knob: hud.el.knob, state, onKey });
		const ro = new ResizeObserver(() => { needResize = true; });
		ro.observe(root);
		unsubscribes.push(() => ro.disconnect());
		// The first genuine tap unlocks sound; play never waits for it.
		const unlock = () => audio.unlock();
		root.addEventListener("pointerdown", unlock, true);
		window.addEventListener("keydown", unlock, true);
		unsubscribes.push(() => {
			root.removeEventListener("pointerdown", unlock, true);
			window.removeEventListener("keydown", unlock, true);
		});
		const applyVolumes = () => audio.setVolumes({ music: Number(tweaks.get("musicVolume")), sfx: Number(tweaks.get("sfxVolume")), muted: state.farm.muted });
		applyVolumes();
		for (const k of ["musicVolume", "sfxVolume"]) unsubscribes.push(tweaks.subscribe(k, applyVolumes));
		unsubscribes.push(tweaks.subscribe("shadows", (v) => { world.renderer.shadowMap.enabled = !!v; world.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }));
		world.renderer.shadowMap.enabled = !!tweaks.get("shadows");
		loading.remove();
	}

	function showLoadError(error) {
		console.error("[farm] loading failed", error);
		loading.innerHTML = `<div class="loading-card"><span>Не удалось загрузить ферму</span><button class="big-btn" type="button">Ещё раз</button></div>`;
		loading.querySelector("button").addEventListener("click", () => location.reload());
	}

	// --- Positions of people ---------------------------------------------------------------
	function sitePos(job, slot) {
		const b = BUILDINGS[job];
		return [b.x + b.w / 2 + 0.7, b.z + b.d / 2 + 0.35 - slot * 0.9];
	}
	function workerPos(w) {
		const info = state.farm.workers[w];
		if (info.job) return sitePos(info.job, w === "senya" ? 0 : w === "petrovich" ? 1 : 2);
		if (w === "senya") return [NEIGHBORS.senya.x, NEIGHBORS.senya.z];
		return WORKER_IDLE[w];
	}
	function npcPos(npc) {
		if (npc === "senya") return workerPos("senya");
		return [NEIGHBORS[npc].x, NEIGHBORS[npc].z];
	}

	// --- Screens ------------------------------------------------------------------------------
	function showScreen(id, opts = {}) {
		// Opening any other screen before a hero is chosen (the editor can) arrives as Максим.
		if (id !== "screen:choose" && !state.farm.hero) state.farm.hero = "max";
		state.screen = id || null;
		state.ui = { tab: opts.tab ?? null, lot: opts.lot ?? null };
		state.input.actionHeld = false;
		if (id) {
			input?.clear();
			if (state.placing && id !== "screen:build") A.cancelPlacing(state);
		}
		if (id === "screen:morning") state.recap = state.recap || [];
	}
	function getScreen() {
		return state.screen;
	}

	function onKey(k) {
		if (k === "action") state.queue.push({ type: "action" });
		else if (k === "close") state.queue.push({ type: "cmd", cmd: "close" });
		else state.queue.push({ type: "cmd", cmd: k });
	}

	// --- Ads: requested straight from the player's tap ------------------------------------------
	function adsAvailable() {
		try { return !!sdk.ads?.isAvailable("rewarded"); } catch { return false; }
	}
	function requestAd(cmd, arg) {
		if (state.adPending || !adsAvailable()) return;
		state.adPending = true;
		sdk.ads.showRewarded({ placement: "boost" })
			.catch(() => ({ status: "failed" }))
			.then(({ status }) => {
				state.adPending = false;
				if (status === "completed") state.queue.push({ type: "adReward", what: cmd, id: arg });
			});
	}

	// --- Sleep ----------------------------------------------------------------------------------
	function sleep(passedOut = false) {
		if (state.fishing) state.fishing = null;
		if (state.placing) A.cancelPlacing(state);
		const farm = state.farm;
		state.recap = newDay(state, cfg);
		state.recapPassedOut = passedOut;
		farm.player.x = SPOTS.door[0];
		farm.player.z = SPOTS.door[1] + 0.4;
		farm.player.face = 0;
		showScreen("screen:morning");
		audio.play("morning");
		saveNow();
	}

	// --- Saving -------------------------------------------------------------------------------
	function saveNow() {
		if (!state.farm.hero) return;
		const data = toSave(state.farm);
		savedFarm = fromSave(data, cfg.startCoins);
		dirty = false;
		saveTimer = 0;
		sdk.gameState.save(data).catch(() => {});
	}

	function newFarm() {
		savedFarm = null;
		sdk.gameState.clear().catch(() => {});
		firstInit = true;
	}

	// --- Commands -----------------------------------------------------------------------------
	function command(c) {
		const farm = state.farm;
		const arg = c.arg;
		switch (c.cmd) {
			case "orders": showScreen(state.screen === "screen:orders" ? null : "screen:orders"); break;
			case "build": showScreen(state.screen === "screen:build" ? null : "screen:build", { tab: "buildings" }); break;
			case "bag": showScreen(state.screen === "screen:bag" ? null : "screen:bag", { tab: "items" }); break;
			case "seeds": showScreen("screen:bag", { tab: "seeds" }); break;
			case "close": if (state.screen !== "screen:choose") showScreen(null); break;
			case "tab": state.ui = { ...state.ui, tab: arg }; break;
			case "hero":
				farm.hero = arg;
				showScreen(null);
				state.fx.push({ type: "toast", text: "Собери спелый редис и отнеси Бабе Нюре — она у поля", tone: "good" });
				dirty = true;
				break;
			case "select-seed": farm.selectedSeed = arg; showScreen(null); break;
			case "buy-seed": A.buySeed(state, arg, Number(c.arg2)); break;
			case "buy-hay": A.buyHay(state, Number(arg)); break;
			case "buy-animal": A.buyAnimal(state, arg); break;
			case "sell": A.sell(state, arg, Number(c.arg2)); break;
			case "sell-all": A.sellAll(state); break;
			case "start-build": A.startBuild(state, arg); break;
			case "hire": A.hire(state, arg); break;
			case "buy-decor": A.buyDecor(state, arg); break;
			case "cancel-place": A.cancelPlacing(state); break;
			case "mute":
				farm.muted = !farm.muted;
				audio.setVolumes({ muted: farm.muted });
				break;
			default: return;
		}
		if (!["tab", "orders", "build", "bag", "seeds", "close"].includes(c.cmd)) dirty = true;
		audio.play("ui");
	}

	function act() {
		if (state.screen) return;
		if (state.fishing) {
			tapFishing(state, cfg);
			dirty = true;
			return;
		}
		const t = state.target;
		const anim = performTarget(state, t, cfg, npcPos);
		if (anim) {
			state.anim.action = anim === "wave" ? null : anim;
			state.anim.actionT = 0.5;
			holdCooldown = 0.32;
		}
		if (t) dirty = true;
	}

	function handleQueue() {
		const q = state.queue.splice(0);
		for (const item of q) {
			if (item.type === "action") act();
			else if (item.type === "cmd") command(item);
			else if (item.type === "screen") showScreen(item.id, { tab: item.tab, lot: item.lot });
			else if (item.type === "sleep") sleep(!!item.passedOut);
			else if (item.type === "fish") startFishing(state);
			else if (item.type === "adReward") {
				if (item.what === "rain") A.warmRain(state);
				else if (item.what === "rush") A.rushBuild(state, item.id);
				dirty = true;
			}
		}
	}

	// --- Movement and collision ---------------------------------------------------------------
	function obstacles() {
		const list = world.colliders.slice();
		for (const [id, b] of Object.entries(state.farm.buildings)) {
			if (b.state === "none" || id === "greenhouse") continue;
			const def = BUILDINGS[id];
			list.push({ box: [def.x - def.w / 2, def.z - def.d / 2, def.x + def.w / 2, def.z + def.d / 2] });
		}
		for (const npc of NEIGHBOR_ORDER) {
			const [x, z] = npcPos(npc);
			list.push({ x, z, r: 0.3 });
		}
		for (const d of state.farm.decor) if (d.kind === "birch" || d.kind === "lantern" || d.kind === "scarecrow") list.push({ x: d.x, z: d.z, r: 0.25 });
		return list;
	}

	function collide(p) {
		for (const o of obstacles()) {
			if (o.box) {
				const [x0, z0, x1, z1] = o.box;
				const cx = Math.max(x0, Math.min(p.x, x1));
				const cz = Math.max(z0, Math.min(p.z, z1));
				const dx = p.x - cx;
				const dz = p.z - cz;
				const d = Math.hypot(dx, dz);
				if (d < PLAYER_R) {
					if (d > 1e-4) {
						p.x = cx + (dx / d) * PLAYER_R;
						p.z = cz + (dz / d) * PLAYER_R;
					} else p.z = z1 + PLAYER_R;
				}
			} else {
				const dx = p.x - o.x;
				const dz = p.z - o.z;
				const d = Math.hypot(dx, dz);
				const min = o.r + PLAYER_R;
				if (d < min && d > 1e-4) {
					p.x = o.x + (dx / d) * min;
					p.z = o.z + (dz / d) * min;
				}
			}
		}
		// Bounds: land, plus the pier reaching into the river.
		const onPierX = p.x > PIER.minX + 0.25 && p.x < PIER.maxX - 0.25;
		p.x = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, p.x));
		p.z = Math.max(BOUNDS.minZ, p.z);
		if (p.z > BOUNDS.maxZ) {
			if (onPierX) p.z = Math.min(PIER.maxZ - 0.3, p.z);
			else if (p.z > BOUNDS.maxZ + 0.05) {
				// Off the pier's sides above water: push back onto it or the bank.
				if (p.z > PIER.minZ + 1) p.x = Math.max(PIER.minX + 0.25, Math.min(PIER.maxX - 0.25, p.x));
				else p.z = BOUNDS.maxZ;
			}
		}
	}

	function move(dt) {
		const inp = state.input;
		let mx = inp.mx + inp.kx;
		let mz = inp.mz + inp.kz;
		const mag = Math.min(1, Math.hypot(mx, mz));
		const p = state.farm.player;
		if (mag > 0.05 && !state.screen) {
			if (state.fishing && (state.fishing.phase === "cast" || state.fishing.phase === "wait" || state.fishing.phase === "result")) state.fishing = null;
			if (!state.fishing) {
				const d = Math.hypot(mx, mz);
				mx /= d;
				mz /= d;
				const speed = cfg.walkSpeed * mag;
				p.x += mx * speed * dt;
				p.z += mz * speed * dt;
				collide(p);
				p.face = Math.atan2(mx, mz);
				state.anim.phase += speed * dt * 2.6;
			}
		}
		const walking = mag > 0.05 && !state.fishing && !state.screen;
		state.anim.walk += ((walking ? Math.min(1, mag * 1.2) : 0) - state.anim.walk) * Math.min(1, dt * 10);
		state.anim.actionT = Math.max(0, state.anim.actionT - dt);
	}

	// --- Decor placement -------------------------------------------------------------------------
	function updatePlacing() {
		const pl = state.placing;
		if (!pl) return;
		const p = state.farm.player;
		const x = Math.round((p.x + Math.sin(p.face) * 1.5) * 2) / 2;
		const z = Math.round((p.z + Math.cos(p.face) * 1.5) * 2) / 2;
		pl.x = x;
		pl.z = z;
		pl.rot = Math.abs(Math.sin(p.face)) > 0.7 ? Math.PI / 2 : 0;
		let ok = x > BOUNDS.minX + 0.5 && x < BOUNDS.maxX - 0.5 && z > BOUNDS.minZ + 0.5 && z < BOUNDS.maxZ - 0.6;
		if (ok) for (const plot of state.farm.plots) {
			const [px, pz] = plotCenter(plot);
			if (Math.abs(px - x) < 1.1 && Math.abs(pz - z) < 1.1) { ok = false; break; }
		}
		if (ok) for (const b of Object.values(BUILDINGS)) {
			if (Math.abs(b.x - x) < b.w / 2 + 0.6 && Math.abs(b.z - z) < b.d / 2 + 0.6) { ok = false; break; }
		}
		if (ok) for (const o of world.colliders) {
			if (o.box ? x > o.box[0] - 0.6 && x < o.box[2] + 0.6 && z > o.box[1] - 0.6 && z < o.box[3] + 0.6 : Math.hypot(o.x - x, o.z - z) < o.r + 0.6) { ok = false; break; }
		}
		if (ok) for (const d of state.farm.decor) if (Math.hypot(d.x - x, d.z - z) < 0.9) { ok = false; break; }
		if (ok) for (const npc of NEIGHBOR_ORDER) { const [nx, nz] = npcPos(npc); if (Math.hypot(nx - x, nz - z) < 1) { ok = false; break; } }
		if (ok && Math.hypot(SPOTS.door[0] - x, SPOTS.door[1] - z) < 1.4) ok = false;
		if (ok && Math.abs(x + 0.4) < 1.3 && z > 9) ok = false;
		pl.ok = ok;
	}

	// --- Feedback events → effects ----------------------------------------------------------------
	function haptic(ms) {
		try { if (sdk.device.haptics.isSupported()) sdk.device.haptics.vibrate(ms); } catch { /* optional */ }
	}
	function drainFx() {
		const list = state.fx.splice(0);
		for (const e of list) {
			if (e.type === "sfx") audio.play(e.name);
			else if (e.type === "toast") hud.addToast(e);
			else if (e.type === "float") hud.addFloat(e);
			else if (e.type === "burst") fx.burst(e.x, e.y ?? 0.3, e.z, e.kind, e.n);
			else if (e.type === "haptic") haptic(e.ms);
			else if (e.type === "wave") state.waves[e.npc] = 1.4;
			else if (e.type === "built") {
				const b = BUILDINGS[e.id];
				fx.burst(b.x, 2, b.z, "spark", 30);
				fx.burst(b.x, 1, b.z, "wood", 14);
				hud.addToast({ text: `${b.name} готов${e.id === "greenhouse" || e.id === "mill" ? "а" : ""}!`, tone: "gift" });
				audio.play("built");
				haptic(30);
				dirty = true;
			} else if (e.type === "coinsUp") hud.addFloat({ x: state.farm.player.x, z: state.farm.player.z, y: 2.2, text: `+${e.amount}`, icon: ["ITEM_ICONS", "coin"] });
			else if (e.type === "first") haptic(25);
		}
	}

	// --- Hooks ------------------------------------------------------------------------------------
	const hooks = {
		init(s) {
			// Rebuild the run from the last saved farm (or a fresh one).
			s.farm = savedFarm ? fromSave(toSave(savedFarm), cfg.startCoins) : freshFarm(cfg.startCoins);
			if (!savedFarm) {
				// First arrival: the hero stands at the ripe radishes, facing them.
				s.farm.player = { x: -1.05, z: 1.35, face: Math.PI };
				ensureOrders(s.farm, seasonOf(s.farm, cfg.seasonDays));
			}
			s.queue = [];
			s.fx = [];
			s.target = null;
			s.fishing = null;
			s.placing = null;
			s.recap = null;
			s.sleepQueued = false;
			s.waves = {};
			s.anim = { walk: 0, phase: 0, action: null, actionT: 0 };
			if (firstInit) {
				firstInit = false;
				s.screen = s.farm.hero ? null : "screen:choose";
				s.ui = { tab: null, lot: null };
			} else if (s.screen === "screen:choose" && s.farm.hero) s.screen = null;
			if (!s.farm.hero) s.screen = "screen:choose";
			audio.setVolumes({ muted: s.farm.muted });
		},
		update(s, dt) {
			if (!world) return;
			s.time += dt;
			handleQueue();
			move(dt);
			const paused = !!s.screen;
			if (!paused) tick(s, dt, cfg);
			updateFishing(s, dt);
			updatePlacing();
			s.target = s.screen || s.fishing ? null : findTarget(s, npcPos);
			// Holding the button repeats field work across plots.
			holdCooldown -= dt;
			if (s.input.actionHeld && holdCooldown <= 0 && s.target?.kind === "plot" && !s.target.disabled && !s.fishing) act();
			for (const k of Object.keys(s.waves)) s.waves[k] = Math.max(0, s.waves[k] - dt);
			s.shake = Math.max(0, s.shake - dt);
			s.millSpin = Math.max(0, s.millSpin - dt);
			s.rainT = Math.max(0, s.rainT - dt);
			drainFx();
			hud.step(dt);
			fx.update(dt, view.camTarget, seasonOf(s.farm, cfg.seasonDays), s.rainT > 0);
			world.animateWater(dt);
			saveTimer += dt;
			if (dirty && saveTimer > 4) saveNow();
		},
		render(s) {
			if (!world) return;
			audio.setPaused(!!runRef?.frozen);
			if (needResize) {
				const r = root.getBoundingClientRect();
				if (r.width && r.height) {
					view.resize(r.width, r.height);
					needResize = false;
				}
			}
			const season = seasonOf(s.farm, cfg.seasonDays);
			world.applySeason(season);
			const { sunDir } = world.applyTime(s.farm.hour, season);
			const rdt = Math.min(0.1, Math.max(0, s.time - lastRenderTime));
			lastRenderTime = s.time;
			view.sync(s, { time: s.time, dt: rdt, zoom: cfg.zoom, npcPos, workerPos, sunDir });
			hud.render({ cfg, project: view.project, npcPos, ads: { rewarded: adsAvailable() } });
			world.renderer.render(world.scene, world.camera);
		},
	};

	// --- Named actions (the Creator Tools call these too) ------------------------------------------
	function addCoins(n) {
		state.farm.coins += n;
		dirty = true;
	}
	function growAll() {
		for (const p of state.farm.plots) if (p.crop) p.growth = 999;
		dirty = true;
	}

	return {
		state,
		hooks,
		preload: () => preload().catch((e) => { showLoadError(e); throw e; }),
		showScreen,
		getScreen,
		sleep,
		addCoins,
		growAll,
		newFarm,
		npcPos,
		workerPos,
		season: () => seasonOf(state.farm, cfg.seasonDays),
		attachRun(r) { runRef = r; },
		get view() { return view; },
		get hud() { return hud; },
		destroy() {
			for (const u of unsubscribes) u();
			input?.destroy();
			audio.destroy();
			world?.renderer.dispose();
			mount.replaceChildren();
		},
		DECOR,
	};
}
