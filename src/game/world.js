// The static world and its look: renderer, camera, sun, sky, ground, river,
// trees and village scenery — plus the season and time-of-day palette.
// Dynamic things (plots, buildings, animals, people) are synced in scene.js.
import * as THREE from "three";
import { buildCottage, buildCrate, buildFarmhouse, buildStall, mat, part, windowMat, lanternGlow } from "./builders.js";
import { BOUNDS, SPOTS } from "./data.js";

const SEASON_LOOK = {
	spring: { grass: 0x8cc152, grassDark: 0x76ad45, birch: 0x9bd35a, sky: [0x9fd3f0, 0xe8f4fb], flowers: true },
	summer: { grass: 0x6fb43f, grassDark: 0x5c9e34, birch: 0x5aa83a, sky: [0x7fc4ee, 0xd8eef9], flowers: true },
	autumn: { grass: 0xb3a646, grassDark: 0x9c8f3a, birch: 0xeaa236, sky: [0xa9c6dc, 0xf1e2c8], flowers: false },
	winter: { grass: 0xeef3f6, grassDark: 0xdde6ec, birch: 0xeef3f6, sky: [0xb8cfe0, 0xeef4f8], flowers: false },
};

function lerpColor(a, b, t) {
	return new THREE.Color(a).lerp(new THREE.Color(b), t);
}

export function createWorld(mount) {
	const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.domElement.className = "world-canvas";
	mount.appendChild(renderer.domElement);

	const scene = new THREE.Scene();
	scene.name = "Берёзовка";
	scene.fog = new THREE.Fog(0xd8eef9, 38, 75);
	const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 160);

	// Lights: sky fill + a warm sun that follows the player so its shadow box stays small.
	const hemi = new THREE.HemisphereLight(0xdff0ff, 0x6b5a3a, 1.1);
	const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
	sun.castShadow = true;
	sun.shadow.mapSize.set(1536, 1536);
	sun.shadow.camera.left = -20;
	sun.shadow.camera.right = 20;
	sun.shadow.camera.top = 20;
	sun.shadow.camera.bottom = -20;
	sun.shadow.camera.near = 1;
	sun.shadow.camera.far = 70;
	sun.shadow.bias = -0.0006;
	sun.shadow.normalBias = 0.03;
	scene.add(hemi, sun, sun.target);

	// --- Ground: grass plane, the bank and the river -------------------------------------
	const grassMat = mat(0x8cc152, { roughness: 1 });
	const grassMatDark = mat(0x76ad45, { roughness: 1 });
	const groundGeo = new THREE.PlaneGeometry(120, 80, 1, 1);
	const ground = new THREE.Mesh(groundGeo, grassMat);
	ground.rotation.x = -Math.PI / 2;
	ground.position.set(0, 0, -27.5);
	ground.receiveShadow = true;
	ground.name = "ground";
	scene.add(ground);
	// The bank: an earth wall dropping to the water along z = 12.5.
	const bank = part(new THREE.BoxGeometry(120, 1.2, 1.2), 0xc8955a);
	bank.position.set(0, -0.6, 12.1);
	scene.add(bank);
	const bankTop = new THREE.Mesh(new THREE.BoxGeometry(120, 0.06, 1.2), grassMatDark);
	bankTop.position.set(0, -0.0, 12.1);
	bankTop.receiveShadow = true;
	scene.add(bankTop);
	const sand = part(new THREE.BoxGeometry(120, 0.3, 1.2), 0xe2c48a);
	sand.position.set(0, -0.6, 13.2);
	scene.add(sand);

	const waterGeo = new THREE.PlaneGeometry(140, 40, 70, 20);
	const waterMat = new THREE.MeshStandardMaterial({ color: 0x3d9ad8, flatShading: true, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.92 });
	const water = new THREE.Mesh(waterGeo, waterMat);
	water.rotation.x = -Math.PI / 2;
	water.position.set(0, -0.55, 33);
	water.receiveShadow = true;
	water.name = "river";
	scene.add(water);
	const waterBase = waterGeo.attributes.position.array.slice();
	// Far bank and meadow beyond the river, so the frame never shows a void.
	const farBank = new THREE.Mesh(new THREE.PlaneGeometry(140, 40), grassMatDark);
	farBank.rotation.x = -Math.PI / 2;
	farBank.position.set(0, -0.3, 63);
	scene.add(farBank);

	// Paths: packed earth from the door to the crate, the village and the pier.
	const pathMat = mat(0xd9b77a, { roughness: 1 });
	const paths = [
		[-1, -6.2, 1.4, 2.4],
		[4.5, -6.4, 10.4, 1.3],
		[13.5, -6.0, 8, 1.4],
		[17.5, -2, 1.4, 9],
		[-0.4, 8.2, 1.4, 6.8],
		[-0.4, 3.2, 1.4, 1.4],
	];
	for (const [x, z, w, d] of paths) {
		const p = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), pathMat);
		p.position.set(x, 0.01, z);
		p.receiveShadow = true;
		scene.add(p);
	}
	for (let i = 0; i < 9; i++) {
		const stone = part(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 7), 0xe8d6b0, { cast: false });
		stone.position.set(-0.4 + Math.sin(i * 1.7) * 0.15, 0.04, 3.8 + i * 0.8);
		scene.add(stone);
	}

	// Pier.
	const pier = new THREE.Group();
	pier.name = "pier";
	for (let i = 0; i < 9; i++) {
		const plank = part(new THREE.BoxGeometry(1.8, 0.1, 0.56), i % 2 ? 0xb88550 : 0xc8955a);
		plank.position.set(-0.4, 0.02, 11.5 + i * 0.58);
		pier.add(plank);
	}
	for (const z of [13, 14.6, 16.1]) {
		for (const x of [-1.25, 0.45]) {
			const post = part(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6), 0x8a5a33);
			post.position.set(x, -0.6, z);
			pier.add(post);
		}
	}
	scene.add(pier);
	// A few rocks and reeds in the water.
	for (const [x, z, s] of [[-5, 14.5, 0.8], [6, 16, 0.6], [-11, 17, 1], [12, 14.2, 0.5]]) {
		const rock = part(new THREE.DodecahedronGeometry(s, 0), 0x9a948a);
		rock.position.set(x, -0.5, z);
		rock.scale.y = 0.6;
		scene.add(rock);
	}
	const reedMat = mat(0x6a9a3a);
	for (let i = 0; i < 24; i++) {
		const reed = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.9, 3), reedMat);
		const x = -18 + i * 1.6 + Math.sin(i * 3.1) * 0.5;
		if (Math.abs(x + 0.4) < 2) continue;
		reed.position.set(x, -0.2, 13.4 + Math.cos(i * 2.3) * 0.25);
		reed.rotation.z = Math.sin(i) * 0.2;
		scene.add(reed);
	}

	// --- Trees ----------------------------------------------------------------------------
	const birchFoliage = new THREE.MeshStandardMaterial({ color: 0x9bd35a, flatShading: true, roughness: 0.9 });
	const pineMat = mat(0x3f7a3a);
	const pineSnow = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9, transparent: true, opacity: 0 });
	const trunkMat = mat(0xf3f0e8);
	const trunkDark = mat(0x6b4a32);
	const stripeMat = mat(0x3a3330);
	const trees = [];
	function birch(x, z, s = 1) {
		const g = new THREE.Group();
		const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 2.2, 6), trunkMat);
		trunk.position.y = 1.1;
		trunk.castShadow = true;
		g.add(trunk);
		for (const y of [0.5, 1.1, 1.7]) {
			const st = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.38), stripeMat);
			st.position.set(0.06, y, 0);
			g.add(st);
		}
		const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), birchFoliage);
		crown.position.y = 2.9;
		crown.scale.set(0.9, 1.25, 0.9);
		crown.castShadow = true;
		g.add(crown);
		g.position.set(x, 0, z);
		g.scale.setScalar(s);
		g.rotation.y = x * 1.3;
		scene.add(g);
		trees.push({ x, z, r: 0.5 * s });
	}
	function pine(x, z, s = 1) {
		const g = new THREE.Group();
		const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1, 6), trunkDark);
		trunk.position.y = 0.5;
		g.add(trunk);
		for (let i = 0; i < 3; i++) {
			const c = new THREE.Mesh(new THREE.ConeGeometry(1.4 - i * 0.35, 1.5, 7), pineMat);
			c.position.y = 1.4 + i * 0.9;
			c.castShadow = true;
			g.add(c);
			const snow = new THREE.Mesh(new THREE.ConeGeometry(0.7 - i * 0.18, 0.6, 7), pineSnow);
			snow.position.y = 1.95 + i * 0.9;
			g.add(snow);
		}
		g.position.set(x, 0, z);
		g.scale.setScalar(s);
		scene.add(g);
		trees.push({ x, z, r: 0.6 * s });
	}
	// North tree line behind the house.
	for (let i = 0; i < 18; i++) {
		const x = -24 + i * 2.9 + Math.sin(i * 2.7) * 0.8;
		const z = -16.5 - Math.abs(Math.cos(i * 1.9)) * 3;
		if (i % 3 === 0) pine(x, z, 1.1 + (i % 2) * 0.2);
		else birch(x, z, 1 + (i % 4) * 0.08);
	}
	// West woods.
	for (let i = 0; i < 9; i++) {
		const z = -13 + i * 2.8;
		const x = -18 - Math.abs(Math.sin(i * 2.1)) * 2.5;
		if (i % 2) pine(x, z, 1.05);
		else birch(x, z, 1.05);
	}
	// A few birches inside the farm for shade.
	birch(-6.5, -12.2, 1);
	birch(4.2, -13, 0.95);
	birch(-15, 1.6, 0.9);
	birch(13.6, 9.8, 0.95);
	birch(-3.6, 11, 0.85);
	pine(19.8, -13.6, 1.0);

	// Grass tufts and wild flowers, instanced.
	const tuftGeo = new THREE.ConeGeometry(0.08, 0.32, 3);
	const tufts = new THREE.InstancedMesh(tuftGeo, grassMatDark, 260);
	const flowerGeo = new THREE.IcosahedronGeometry(0.08, 0);
	const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true });
	const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, 90);
	const m4 = new THREE.Matrix4();
	const isOpenGround = (x, z) => {
		if (x > -5 && x < 4.2 && z > -5 && z < 1.6) return false; // field
		if (x > -4 && x < 2 && z > -12.5 && z < -7) return false; // house
		if (Math.abs(x + 0.4) < 1.2 && z > 1) return false; // path to pier
		return true;
	};
	let seed = 7;
	const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
	let ti = 0;
	for (let i = 0; ti < 260 && i < 2000; i++) {
		const x = BOUNDS.minX - 2 + rnd() * (BOUNDS.maxX - BOUNDS.minX + 4);
		const z = BOUNDS.minZ - 2 + rnd() * (BOUNDS.maxZ - BOUNDS.minZ + 2);
		if (!isOpenGround(x, z)) continue;
		m4.makeTranslation(x, 0.14, z);
		tufts.setMatrixAt(ti++, m4);
	}
	tufts.count = ti;
	scene.add(tufts);
	const flowerColors = [0xffffff, 0xf6e04a, 0xf28ab0, 0xc8a0f0];
	let fi = 0;
	for (let i = 0; fi < 90 && i < 2000; i++) {
		const x = BOUNDS.minX + rnd() * (BOUNDS.maxX - BOUNDS.minX);
		const z = BOUNDS.minZ + rnd() * (BOUNDS.maxZ - BOUNDS.minZ);
		if (!isOpenGround(x, z)) continue;
		m4.makeTranslation(x, 0.12, z);
		flowers.setMatrixAt(fi, m4);
		flowers.setColorAt(fi, new THREE.Color(flowerColors[fi % 4]));
		fi++;
	}
	flowers.count = fi;
	scene.add(flowers);

	// --- Static farm and village props ----------------------------------------------------
	const house = buildFarmhouse();
	house.position.set(-1, 0, -10);
	house.name = "farmhouse";
	scene.add(house);
	const crate = buildCrate();
	crate.position.set(SPOTS.crate[0], 0, SPOTS.crate[1] - 0.5);
	crate.name = "crate";
	scene.add(crate);
	const stall = buildStall();
	stall.position.set(17.6, 0, -5.2);
	stall.rotation.y = -Math.PI / 2;
	stall.name = "stall";
	scene.add(stall);
	for (const [x, z, wall, roof, ry] of [[22, -9, 0xe9d7b5, 0x7a8fb0, -1.2], [23, 1, 0xf0e0c0, 0x9a5a3a, -1.6], [21.5, 8, 0xe2d2b8, 0x6a8a5a, -1.9], [12, -16.5, 0xefe2c8, 0xb0503a, 0]]) {
		const c = buildCottage(wall, roof);
		c.position.set(x, 0, z);
		c.rotation.y = ry;
		scene.add(c);
	}
	// Senya's little tractor beside his spot.
	const tractor = new THREE.Group();
	const hull = part(new THREE.BoxGeometry(1.2, 0.7, 2), 0xd8432e);
	hull.position.set(0, 0.9, 0);
	const cab = part(new THREE.BoxGeometry(0.9, 0.8, 0.8), 0xd8432e);
	cab.position.set(0, 1.6, -0.4);
	tractor.add(hull, cab);
	for (const [x, z, r] of [[-0.7, -0.6, 0.6], [0.7, -0.6, 0.6], [-0.65, 0.7, 0.38], [0.65, 0.7, 0.38]]) {
		const wheel = part(new THREE.CylinderGeometry(r, r, 0.3, 10), 0x2e2a28);
		wheel.rotation.z = Math.PI / 2;
		wheel.position.set(x, r, z);
		tractor.add(wheel);
	}
	tractor.position.set(17.2, 0, 4.6);
	tractor.rotation.y = -0.4;
	scene.add(tractor);
	// Field fence along the north edge of the farm, for a sense of boundary.
	const fenceMat = mat(0x9a6a3c);
	for (let i = 0; i < 16; i++) {
		const x = -15 + i * 2.2;
		if (x > -4 && x < 2) continue;
		const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), fenceMat);
		post.position.set(x, 0.4, -14.6);
		post.castShadow = true;
		const rail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.06), fenceMat);
		rail.position.set(x + 1.1, 0.55, -14.6);
		scene.add(post, rail);
	}

	// Static colliders (circles): trees, house, crate, stall, cottages, tractor.
	const colliders = [
		...trees,
		{ box: [-3.6, -12, 1.6, -8.1] },
		{ box: [SPOTS.crate[0] - 0.6, SPOTS.crate[1] - 0.95, SPOTS.crate[0] + 0.6, SPOTS.crate[1] - 0.05] },
		{ box: [17.1, -6.5, 18.1, -3.9] },
		{ box: [16.4, 3.4, 18, 5.8] },
	];

	// --- Look: season palette and time of day --------------------------------------------
	let lastSeason = null;
	function applySeason(season) {
		if (season === lastSeason) return;
		lastSeason = season;
		const look = SEASON_LOOK[season];
		grassMat.color.setHex(look.grass);
		grassMatDark.color.setHex(look.grassDark);
		birchFoliage.color.setHex(look.birch);
		birchFoliage.opacity = 1;
		pineSnow.opacity = season === "winter" ? 1 : 0;
		pineSnow.transparent = season !== "winter";
		flowers.visible = look.flowers;
		tufts.visible = season !== "winter";
		waterMat.color.setHex(season === "winter" ? 0x9cc8e0 : 0x3d9ad8);
	}

	// hour: 6..26. Returns how dark it is (0 day .. 1 deep night).
	function applyTime(hour, season) {
		const look = SEASON_LOOK[season];
		const h = hour % 24;
		// Daylight curve: full day 8-18, sunset to 21, night after.
		let day;
		if (hour < 8) day = 0.8 + ((hour - 6) / 2) * 0.2;
		else if (hour < 18) day = 1;
		else if (hour < 21.5) day = 1 - ((hour - 18) / 3.5) * 0.85;
		else day = 0.15;
		const dusk = hour >= 17 && hour < 21.5 ? Math.sin(((hour - 17) / 4.5) * Math.PI) : hour < 7.5 ? 0.6 * (1 - (hour - 6) / 1.5) : 0;
		const top = lerpColor(0x1c2a4a, look.sky[0], day);
		const horizon = lerpColor(0x2a3550, look.sky[1], day).lerp(new THREE.Color(0xf6b27a), dusk * 0.55);
		scene.background = horizon;
		scene.fog.color.copy(horizon);
		hemi.color.copy(top.clone().lerp(new THREE.Color(0xffffff), 0.5));
		hemi.intensity = 0.7 + day * 1.0;
		sun.intensity = 0.35 + day * 2.6;
		sun.color.copy(lerpColor(0x8fa4d8, 0xfff1d6, day).lerp(new THREE.Color(0xff9a5a), dusk * 0.6));
		const night = 1 - day;
		windowMat.emissiveIntensity = night > 0.4 ? 1.2 : 0;
		lanternGlow.emissiveIntensity = night > 0.4 ? 2.2 : 0.2;
		// Sun arc: east in the morning, west in the evening.
		const t = Math.min(1, Math.max(0, (h - 6) / 14));
		return { night, sunDir: new THREE.Vector3(Math.cos(t * Math.PI) * 12, 16 + Math.sin(t * Math.PI) * 8, 10) };
	}

	let clock = 0;
	function animateWater(dt) {
		clock += dt;
		const pos = waterGeo.attributes.position;
		for (let i = 0; i < pos.count; i++) {
			const x = waterBase[i * 3];
			const y = waterBase[i * 3 + 1];
			pos.array[i * 3 + 2] = Math.sin(x * 0.6 + clock * 1.3) * 0.06 + Math.cos(y * 0.8 + clock) * 0.05;
		}
		pos.needsUpdate = true;
	}

	return {
		renderer, scene, camera, sun, hemi, colliders, birchFoliage,
		applySeason, applyTime, animateWater,
	};
}
