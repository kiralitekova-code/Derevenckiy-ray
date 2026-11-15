// Keeps the 3D scene in step with state: the hero, neighbours, workers,
// animals, plots, building lots, decor and the camera. Reads state only.
import * as THREE from "three";
import { poseBiped, poseChicken, poseQuadruped, spawn } from "./actors.js";
import {
	buildBuilding, buildCrop, buildDebris, buildDecor, buildLotSign, buildRuins, buildScaffold, buildTargetRing,
	part, soilDry, soilWet,
} from "./builders.js";
import { BUILDINGS, NEIGHBORS, NEIGHBOR_ORDER, TILE, WORKERS, WORKER_ORDER } from "./data.js";
import { plotCenter } from "./state.js";
import { cropStage, plotActive } from "./sim.js";

const ANIMAL_MODEL = { chicken: "CHICKEN_MODEL", cow: "COW_MODEL", sheep: "SHEEP_MODEL" };

export function createScene(world, models) {
	const { scene, camera } = world;

	// --- Hero --------------------------------------------------------------------------
	let heroKey = null;
	let hero = null;
	const heroRoot = new THREE.Group();
	heroRoot.name = "hero";
	scene.add(heroRoot);
	// Watering can and fishing rod held in the hero's hands (shown by action).
	const can = new THREE.Group();
	const canBody = part(new THREE.CylinderGeometry(0.12, 0.14, 0.24, 8), 0x3f86d0);
	const spout = part(new THREE.CylinderGeometry(0.025, 0.035, 0.3, 5), 0x3f86d0);
	spout.rotation.x = Math.PI / 2.8;
	spout.position.set(0, 0.05, 0.2);
	can.add(canBody, spout);
	const rod = new THREE.Group();
	const rodStick = part(new THREE.CylinderGeometry(0.015, 0.03, 2.2, 5), 0x8a5a33);
	rodStick.position.y = 1.1;
	rod.add(rodStick);
	rod.rotation.x = 0.9;
	const bobber = new THREE.Group();
	const bobTop = part(new THREE.SphereGeometry(0.09, 8, 6), 0xe0402e);
	const bobBottom = part(new THREE.SphereGeometry(0.085, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xffffff);
	bobber.add(bobTop, bobBottom);
	scene.add(bobber);
	const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });
	const line = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 3), lineMat);
	scene.add(line);

	function setHero(key) {
		if (key === heroKey) return;
		heroKey = key;
		if (hero) heroRoot.remove(hero.root);
		hero = spawn(models, key);
		heroRoot.add(hero.root);
		const hand = hero.parts.armR;
		if (hand) {
			can.position.set(0, -0.58, 0.12);
			hand.add(can);
			rod.position.set(0, -0.55, 0.05);
			hand.add(rod);
		}
	}

	// --- Neighbours and workers ----------------------------------------------------------
	const people = {};
	for (const npc of NEIGHBOR_ORDER) {
		const a = spawn(models, NEIGHBORS[npc].model);
		a.root.name = npc;
		scene.add(a.root);
		people[npc] = a;
	}
	for (const w of WORKER_ORDER) {
		if (w === "senya") continue;
		const a = spawn(models, WORKERS[w].model);
		a.root.name = w;
		a.root.visible = false;
		scene.add(a.root);
		people[w] = a;
	}

	// --- Plots -----------------------------------------------------------------------------
	const plotViews = new Map();
	function plotView(plot) {
		let v = plotViews.get(plot.id);
		if (!v) {
			const g = new THREE.Group();
			const size = plot.gh ? 1.0 : TILE - 0.12;
			const soil = new THREE.Mesh(new THREE.BoxGeometry(size, 0.1, size), soilDry);
			soil.receiveShadow = true;
			soil.position.y = 0.05;
			g.add(soil);
			const [x, z] = plotCenter(plot);
			g.position.set(x, 0, z);
			scene.add(g);
			v = { g, soil, crop: null, cropKey: "", debris: null, debrisKey: "", pop: 0 };
			plotViews.set(plot.id, v);
		}
		return v;
	}

	// --- Building lots ---------------------------------------------------------------------
	const lotViews = {};
	for (const [id, b] of Object.entries(BUILDINGS)) {
		const g = new THREE.Group();
		g.position.set(b.x, 0, b.z);
		g.name = `lot_${id}`;
		scene.add(g);
		lotViews[id] = { g, key: "", building: null, scaffold: null, sails: null };
	}
	function syncLot(id, st, frac) {
		const v = lotViews[id];
		const b = BUILDINGS[id];
		if (v.key !== st) {
			v.key = st;
			v.g.clear();
			v.building = v.scaffold = v.sails = null;
			if (st === "none") {
				v.g.add(buildRuins(b.w, b.d));
				const sign = buildLotSign();
				sign.position.set(b.w / 2 - 0.2, 0, b.d / 2 + 0.5);
				v.g.add(sign);
			} else {
				const built = buildBuilding(id);
				v.building = built.group;
				v.sails = built.sails || null;
				v.g.add(built.group);
				if (st === "building") {
					v.scaffold = buildScaffold(b.w, b.d, id === "mill" ? 4.4 : 3);
					v.g.add(v.scaffold);
				}
			}
		}
		if (v.building) v.building.scale.y = st === "building" ? 0.06 + 0.94 * Math.min(1, frac) : 1;
	}

	// --- Animals and decor -------------------------------------------------------------------
	const animalViews = new Map();
	const decorViews = new Map();
	let ghost = null;
	let ghostKind = null;
	const ghostOk = new THREE.MeshBasicMaterial({ color: 0x8cf08c, transparent: true, opacity: 0.55, depthWrite: false });
	const ghostBad = new THREE.MeshBasicMaterial({ color: 0xf06a6a, transparent: true, opacity: 0.55, depthWrite: false });

	const ring = buildTargetRing();
	scene.add(ring);

	// --- Camera -------------------------------------------------------------------------------
	const camTarget = new THREE.Vector3(0, 0, 0);
	let camReady = false;
	const viewDir = new THREE.Vector3(0, 0.74, 0.68).normalize();
	let size = { w: 1, h: 1 };
	let zoom = 1;
	function resize(w, h) {
		size = { w, h };
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		world.renderer.setSize(w, h, false);
	}
	function camDistance() {
		const aspect = size.w / size.h;
		const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
		const wanted = 14 / (2 * tanHalf * aspect);
		return THREE.MathUtils.clamp(wanted, 17, 32) / zoom;
	}

	const tmp = new THREE.Vector3();
	function project(x, y, z) {
		tmp.set(x, y, z).project(camera);
		return { x: (tmp.x * 0.5 + 0.5) * size.w, y: (-tmp.y * 0.5 + 0.5) * size.h, behind: tmp.z > 1 };
	}

	// --- Per-frame sync ---------------------------------------------------------------------------
	function sync(state, ctx) {
		const farm = state.farm;
		const time = ctx.time;
		zoom = ctx.zoom;

		// Hero.
		setHero(farm.hero === "masha" ? "HERO_MASHA_MODEL" : "HERO_MAX_MODEL");
		const p = farm.player;
		heroRoot.position.set(p.x, 0, p.z);
		heroRoot.rotation.y = p.face;
		heroRoot.visible = !!farm.hero;
		const anim = state.anim;
		const fishing = state.fishing;
		const action = fishing ? "fish" : anim.actionT > 0 ? anim.action : null;
		poseBiped(hero, { walk: anim.walk, phase: anim.phase, action, actionT: 0.5 - anim.actionT, time });
		can.visible = action === "water";
		rod.visible = !!fishing;

		// Bobber and line while fishing.
		bobber.visible = line.visible = !!fishing && fishing.phase !== "cast";
		if (bobber.visible) {
			const bx = p.x + Math.sin(p.face) * 2.6;
			const bz = p.z + Math.cos(p.face) * 2.6;
			let by = -0.5 + Math.sin(time * 3) * 0.03;
			if (fishing.phase === "bite") by = -0.62 + Math.sin(time * 30) * 0.06;
			if (fishing.phase === "reel") by = -0.6 + Math.sin(time * 14) * 0.05;
			bobber.position.set(bx, by, bz);
			const tip = new THREE.Vector3(p.x + Math.sin(p.face) * 1.7, 2.1, p.z + Math.cos(p.face) * 1.7);
			const mid = tip.clone().add(bobber.position).multiplyScalar(0.5);
			const len = tip.distanceTo(bobber.position);
			line.position.copy(mid);
			line.scale.set(1, len, 1);
			line.lookAt(bobber.position);
			line.rotateX(Math.PI / 2);
		}

		// People.
		for (const npc of NEIGHBOR_ORDER) {
			const a = people[npc];
			const [x, z] = ctx.npcPos(npc);
			a.root.position.set(x, 0, z);
			const working = npc === "senya" && farm.workers.senya.job;
			const d = Math.hypot(p.x - x, p.z - z);
			const face = working ? workerFace(farm.workers.senya.job, x, z) : d < 5 ? Math.atan2(p.x - x, p.z - z) : NEIGHBORS[npc].face;
			a.root.rotation.y = smoothAngle(a.root.rotation.y, face, 0.12);
			const waving = state.waves[npc] > 0;
			poseBiped(a, { action: working ? "work" : waving ? "wave" : null, actionT: time + x, time: time + x });
		}
		for (const w of WORKER_ORDER) {
			if (w === "senya") continue;
			const a = people[w];
			const info = farm.workers[w];
			a.root.visible = info.hired;
			if (!info.hired) continue;
			const [x, z] = ctx.workerPos(w);
			a.root.position.set(x, 0, z);
			a.root.rotation.y = info.job ? workerFace(info.job, x, z) : Math.atan2(p.x - x, p.z - z) * 0.3 + 0.2;
			poseBiped(a, { action: info.job ? "work" : null, actionT: time * 1.1 + x, time: time + x });
		}

		// Plots.
		for (const plot of farm.plots) {
			const v = plotView(plot);
			const active = plotActive(farm, plot);
			v.g.visible = active;
			if (!active) continue;
			v.soil.visible = plot.kind === "soil";
			v.soil.material = plot.watered ? soilWet : soilDry;
			const dk = plot.kind === "debris" ? `${plot.debris}` : "";
			if (dk !== v.debrisKey) {
				if (v.debris) v.g.remove(v.debris);
				v.debris = dk ? buildDebris(plot.debris) : null;
				if (v.debris) v.g.add(v.debris);
				v.debrisKey = dk;
			}
			if (v.debris) {
				const shake = plot.hits > 0 ? Math.sin(time * 40) * 0.04 * plot.hits : 0;
				v.debris.position.x = shake;
			}
			const st = cropStage(plot);
			const ck = plot.crop ? `${plot.crop}:${st}` : "";
			if (ck !== v.cropKey) {
				if (v.crop) v.g.remove(v.crop);
				v.crop = ck ? buildCrop(plot.crop, st) : null;
				if (v.crop) {
					v.crop.position.y = 0.1;
					v.g.add(v.crop);
				}
				v.cropKey = ck;
				v.pop = time;
			}
			if (v.crop) {
				const k = Math.min(1, (time - v.pop) / 0.3);
				const s = 0.6 + 0.4 * (1 - Math.pow(1 - k, 3)) + (k < 1 ? Math.sin(k * Math.PI) * 0.15 : 0);
				const bob = st === 3 ? Math.sin(time * 3 + plot.c + plot.r) * 0.04 : 0;
				v.crop.scale.setScalar(s * 1.25 * (1 + bob));
				v.crop.rotation.z = st === 3 ? Math.sin(time * 2 + plot.c) * 0.05 : 0;
			}
		}

		// Lots.
		for (const [id, b] of Object.entries(farm.buildings)) {
			syncLot(id, b.state, b.progress / BUILDINGS[id].hours);
			const v = lotViews[id];
			if (v.sails) v.sails.rotation.z += ctx.dt * (state.millSpin > 0 ? 5 : 0.6);
			if (v.scaffold) v.scaffold.position.y = Math.sin(time * 20) * 0.004;
		}

		// Animals.
		const seen = new Set();
		for (const a of farm.animals) {
			seen.add(a.id);
			let v = animalViews.get(a.id);
			if (!v) {
				v = spawn(models, ANIMAL_MODEL[a.kind]);
				v.root.name = a.id;
				scene.add(v.root);
				animalViews.set(a.id, v);
			}
			v.root.position.set(a.x, 0, a.z);
			v.root.rotation.y = smoothAngle(v.root.rotation.y, a.face || 0, 0.2);
			const walk = a.moving ? 1 : 0;
			if (a.kind === "chicken") poseChicken(v, { walk, phase: a.phase || 0, time, peck: !a.moving && Math.sin(time * 0.7 + a.x) > 0.6 ? time : 0 });
			else poseQuadruped(v, { walk, phase: a.phase || 0, time, graze: a.moving ? 0 : 0.5 + Math.sin(time * 0.5 + a.z) * 0.5 });
		}
		for (const [id, v] of animalViews) {
			if (!seen.has(id)) {
				scene.remove(v.root);
				animalViews.delete(id);
			}
		}

		// Decor.
		const seenD = new Set();
		for (const d of farm.decor) {
			seenD.add(d.id);
			if (!decorViews.has(d.id)) {
				const g = buildDecor(d.kind, world.birchFoliage);
				g.position.set(d.x, 0, d.z);
				g.rotation.y = d.rot || 0;
				g.name = d.id;
				scene.add(g);
				decorViews.set(d.id, { g, born: time });
			}
			const v = decorViews.get(d.id);
			const k = Math.min(1, (time - v.born) / 0.35);
			v.g.scale.setScalar(k < 1 ? 0.5 + 0.5 * k + Math.sin(k * Math.PI) * 0.2 : 1);
		}
		for (const [id, v] of decorViews) {
			if (!seenD.has(id)) {
				scene.remove(v.g);
				decorViews.delete(id);
			}
		}

		// Placement ghost.
		const pl = state.placing;
		if (pl) {
			if (ghostKind !== pl.kind) {
				if (ghost) scene.remove(ghost);
				ghost = buildDecor(pl.kind, world.birchFoliage);
				ghost.traverse((o) => { if (o.isMesh) o.castShadow = false; });
				scene.add(ghost);
				ghostKind = pl.kind;
			}
			ghost.position.set(pl.x, 0, pl.z);
			ghost.rotation.y = pl.rot;
			const m = pl.ok ? ghostOk : ghostBad;
			ghost.traverse((o) => { if (o.isMesh) o.material = m; });
		} else if (ghost) {
			scene.remove(ghost);
			ghost = null;
			ghostKind = null;
		}

		// Target ring.
		const t = state.target;
		ring.visible = !!t && !fishing && !state.screen;
		if (ring.visible) {
			ring.position.set(t.x, 0.13, t.z);
			const s = (t.ring || 0.75) / 0.62 * (1 + Math.sin(time * 5) * 0.05);
			ring.scale.set(s, s, s);
			ring.material.color.setHex(t.disabled ? 0xbcbcbc : 0xfff3c4);
		}

		// Camera follows the hero, clamped so the frame stays inside the world.
		const target = new THREE.Vector3(
			THREE.MathUtils.clamp(p.x, -12, 15),
			0,
			THREE.MathUtils.clamp(p.z, -11, fishing || p.z > 11 ? 13 : 10),
		);
		if (!camReady) {
			camTarget.copy(target);
			camReady = true;
		} else camTarget.lerp(target, Math.min(1, ctx.dt * 4));
		const dist = camDistance();
		const shake = state.shake > 0 ? state.shake * 0.4 : 0;
		camera.position.copy(camTarget).addScaledVector(viewDir, dist);
		camera.position.x += (Math.random() - 0.5) * shake;
		camera.position.y += (Math.random() - 0.5) * shake;
		camera.lookAt(camTarget.x, 0.6, camTarget.z - 0.5);

		// Sun follows the view so the shadow box always covers the frame.
		const sunDir = ctx.sunDir;
		world.sun.position.set(camTarget.x + sunDir.x, sunDir.y, camTarget.z + sunDir.z);
		world.sun.target.position.set(camTarget.x, 0, camTarget.z - 2);
	}

	function workerFace(job, x, z) {
		const b = BUILDINGS[job];
		return Math.atan2(b.x - x, b.z - z);
	}

	return { sync, resize, project, camTarget, heroRoot, people, lotViews, animalViews, plotViews };
}

function smoothAngle(a, b, k) {
	let d = b - a;
	while (d > Math.PI) d -= Math.PI * 2;
	while (d < -Math.PI) d += Math.PI * 2;
	return a + d * k;
}
