// Geometry for everything built in code: buildings, ruins, scaffolding, crops,
// decor and props. Origin of each piece is the centre of its base; front faces +Z.
// One flat-shaded material per colour keeps the low-poly look consistent.
import * as THREE from "three";

const mats = new Map();
export function mat(color, extra = {}) {
	const key = `${color}|${JSON.stringify(extra)}`;
	if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...extra }));
	return mats.get(key);
}

export function part(geometry, material, { cast = true, receive = true } = {}) {
	const m = new THREE.Mesh(geometry, typeof material === "number" ? mat(material) : material);
	m.castShadow = cast;
	m.receiveShadow = receive;
	return m;
}

function boxAt(w, h, d, color, x, y, z) {
	const m = part(new THREE.BoxGeometry(w, h, d), color);
	m.position.set(x, y, z);
	return m;
}

// A gable roof: triangular prism along X, sitting with its eaves at y.
function gableRoof(w, d, h, color, y, overhang = 0.25) {
	const shape = new THREE.Shape();
	const hw = d / 2 + overhang;
	shape.moveTo(-hw, 0);
	shape.lineTo(hw, 0);
	shape.lineTo(0, h);
	shape.closePath();
	const geo = new THREE.ExtrudeGeometry(shape, { depth: w + overhang * 2, bevelEnabled: false });
	geo.translate(0, 0, -(w + overhang * 2) / 2);
	const roof = part(geo, color);
	roof.rotation.y = Math.PI / 2;
	roof.position.y = y;
	return roof;
}

function gableWall(w, h, color, y, z) {
	// Triangle filling the gable end of a wall.
	const shape = new THREE.Shape();
	shape.moveTo(-w / 2, 0);
	shape.lineTo(w / 2, 0);
	shape.lineTo(0, h);
	shape.closePath();
	const m = part(new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false }), color);
	m.position.set(0, y, z);
	return m;
}

export const windowMat = new THREE.MeshStandardMaterial({ color: 0x9fd0e8, emissive: 0xffc46b, emissiveIntensity: 0, flatShading: true, roughness: 0.4 });

function windowAt(x, y, z, w = 0.6, h = 0.55, ry = 0) {
	const g = new THREE.Group();
	g.add(boxAt(w + 0.12, h + 0.12, 0.06, 0xf4ead6, 0, 0, 0));
	const glass = part(new THREE.BoxGeometry(w, h, 0.08), windowMat, { cast: false });
	g.add(glass);
	g.add(boxAt(0.05, h, 0.1, 0xf4ead6, 0, 0, 0));
	g.position.set(x, y, z);
	g.rotation.y = ry;
	return g;
}

export function buildFarmhouse() {
	const g = new THREE.Group();
	const w = 5, d = 3.8, h = 2.5;
	g.add(boxAt(w + 0.2, 0.3, d + 0.2, 0xb7a58a, 0, 0.15, 0));
	g.add(boxAt(w, h, d, 0xf3e6c8, 0, 0.3 + h / 2, 0));
	g.add(gableWall(d, 1.6, 0xf3e6c8, 0.3 + h, 0).rotateY(Math.PI / 2).translateZ(-w / 2));
	const gable2 = gableWall(d, 1.6, 0xf3e6c8, 0.3 + h, 0);
	gable2.rotation.y = -Math.PI / 2;
	gable2.position.x = w / 2;
	g.add(gable2);
	g.add(gableRoof(w, d, 1.7, 0xd0623a, 0.3 + h));
	g.add(boxAt(0.55, 1.3, 0.55, 0xc9a77f, 1.4, 3.8, -0.6));
	g.add(boxAt(0.65, 0.12, 0.65, 0x8a6d52, 1.4, 4.45, -0.6));
	// Door, steps, windows.
	g.add(boxAt(0.95, 1.6, 0.1, 0x8a5a33, 0, 1.1, d / 2 + 0.02));
	g.add(boxAt(0.12, 0.12, 0.08, 0xd8b24a, 0.3, 1.1, d / 2 + 0.09));
	g.add(boxAt(1.4, 0.18, 0.6, 0xc9b593, 0, 0.09, d / 2 + 0.35));
	g.add(windowAt(-1.55, 1.75, d / 2 + 0.03));
	g.add(windowAt(1.55, 1.75, d / 2 + 0.03));
	g.add(windowAt(-w / 2 - 0.03, 1.75, 0, 0.6, 0.55, Math.PI / 2));
	// Barrel and logs by the door.
	const barrel = part(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 8), 0x9a6a3c);
	barrel.position.set(-2.1, 0.35, d / 2 + 0.6);
	g.add(barrel);
	return g;
}

export function buildCrate() {
	const g = new THREE.Group();
	g.add(boxAt(1.1, 0.7, 0.8, 0xb07a44, 0, 0.35, 0));
	for (const y of [0.15, 0.55]) g.add(boxAt(1.14, 0.08, 0.84, 0x8a5a33, 0, y, 0));
	const lid = boxAt(1.16, 0.08, 0.86, 0x9a6a3c, 0, 0.74, -0.1);
	lid.rotation.x = -0.35;
	g.add(lid);
	return g;
}

export function buildStall() {
	const g = new THREE.Group();
	g.add(boxAt(2.4, 0.9, 0.9, 0xb07a44, 0, 0.45, 0));
	g.add(boxAt(2.5, 0.08, 1.0, 0x8a5a33, 0, 0.94, 0));
	for (const x of [-1.15, 1.15]) {
		g.add(boxAt(0.1, 2.3, 0.1, 0x8a5a33, x, 1.15, -0.4));
		g.add(boxAt(0.1, 2.0, 0.1, 0x8a5a33, x, 1.0, 0.4));
	}
	// Striped awning.
	for (let i = 0; i < 6; i++) {
		const s = boxAt(0.42, 0.06, 1.3, i % 2 ? 0xf5efe3 : 0xd0423a, -1.05 + i * 0.42, 2.15, 0.1);
		s.rotation.x = 0.25;
		g.add(s);
	}
	// Produce on the counter.
	const colors = [0xe8742a, 0xd94a5a, 0xf2c94a, 0x7fb54a];
	colors.forEach((c, i) => {
		const p = part(new THREE.IcosahedronGeometry(0.16, 0), c);
		p.position.set(-0.8 + i * 0.5, 1.1, 0.1);
		g.add(p);
	});
	return g;
}

// Village houses outside the farm, for depth.
export function buildCottage(wall = 0xe9d7b5, roof = 0x7a8fb0) {
	const g = new THREE.Group();
	g.add(boxAt(3.2, 2.1, 3, wall, 0, 1.05, 0));
	g.add(gableRoof(3.2, 3, 1.4, roof, 2.1));
	g.add(windowAt(-0.8, 1.3, 1.53, 0.5, 0.5));
	g.add(windowAt(0.8, 1.3, 1.53, 0.5, 0.5));
	g.add(boxAt(0.4, 1.0, 0.4, 0xa58b6f, 0.9, 3.1, -0.4));
	return g;
}

// ---- Farm buildings: each returns { group, sails? } ----------------------------------

function buildCoop() {
	const g = new THREE.Group();
	for (const [x, z] of [[-1.2, -0.9], [1.2, -0.9], [-1.2, 0.9], [1.2, 0.9]]) g.add(boxAt(0.14, 0.5, 0.14, 0x8a5a33, x, 0.25, z));
	g.add(boxAt(2.7, 1.5, 2.1, 0xd9a24e, 0, 1.25, 0));
	for (let i = 0; i < 5; i++) g.add(boxAt(2.74, 0.04, 2.14, 0xb8833a, 0, 0.62 + i * 0.3, 0));
	g.add(gableRoof(2.7, 2.1, 1.0, 0xd0623a, 2.0, 0.2));
	g.add(boxAt(0.6, 0.7, 0.06, 0x4a3020, -0.5, 1.0, 1.06));
	const ramp = boxAt(0.5, 0.06, 1.1, 0xb8833a, -0.5, 0.35, 1.5);
	ramp.rotation.x = 0.55;
	g.add(ramp);
	g.add(windowAt(0.7, 1.4, 1.07, 0.45, 0.4));
	return { group: g };
}

function buildBarnShape(w, d, h, wall, roofColor) {
	const g = new THREE.Group();
	g.add(boxAt(w, h, d, wall, 0, h / 2, 0));
	g.add(gableWall(d, 1.3, wall, h, 0).rotateY(Math.PI / 2).translateZ(-w / 2));
	const gw = gableWall(d, 1.3, wall, h, 0);
	gw.rotation.y = -Math.PI / 2;
	gw.position.x = w / 2;
	g.add(gw);
	g.add(gableRoof(w, d, 1.4, roofColor, h, 0.2));
	return g;
}

function barnDoors(g, w, h, z) {
	g.add(boxAt(w, h, 0.08, 0xf5efe3, 0, h / 2, z));
	g.add(boxAt(w - 0.16, h - 0.16, 0.1, 0xb8352c, 0, h / 2, z));
	const x1 = boxAt(0.1, Math.hypot(w, h) * 0.85, 0.12, 0xf5efe3, 0, h / 2, z + 0.02);
	x1.rotation.z = Math.atan2(w, h);
	const x2 = x1.clone();
	x2.rotation.z = -Math.atan2(w, h);
	g.add(x1, x2);
}

function buildCowshed() {
	const g = buildBarnShape(4.0, 2.8, 2.2, 0xc0392b, 0x4a4a4f);
	barnDoors(g, 1.5, 1.7, 1.42);
	g.add(windowAt(-1.3, 1.5, 1.42, 0.5, 0.45));
	g.add(windowAt(1.3, 1.5, 1.42, 0.5, 0.45));
	g.add(boxAt(4.1, 0.12, 2.9, 0xf5efe3, 0, 2.2, 0));
	return { group: g };
}

function buildSheepfold() {
	const g = buildBarnShape(3.4, 2.4, 1.9, 0xf0e2c6, 0x8a5a33);
	g.add(boxAt(0.9, 1.3, 0.08, 0x5a3b22, -0.6, 0.65, 1.22));
	g.add(windowAt(0.9, 1.25, 1.22, 0.5, 0.45));
	return { group: g };
}

function buildBarn() {
	const g = buildBarnShape(4.0, 3.4, 2.8, 0xc0392b, 0x6b4a32);
	barnDoors(g, 1.8, 2.1, 1.72);
	g.add(windowAt(0, 3.4, 1.72, 0.5, 0.5));
	g.add(boxAt(4.1, 0.14, 3.5, 0xf5efe3, 0, 2.8, 0));
	return { group: g };
}

function buildWell() {
	const g = new THREE.Group();
	const ring = part(new THREE.CylinderGeometry(0.75, 0.8, 0.8, 10), 0x9a9a96);
	ring.position.y = 0.4;
	g.add(ring);
	const water = part(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 10), new THREE.MeshStandardMaterial({ color: 0x3d8fd0, flatShading: true }));
	water.position.y = 0.7;
	g.add(water);
	for (const x of [-0.7, 0.7]) g.add(boxAt(0.12, 1.5, 0.12, 0x8a5a33, x, 1.3, 0));
	const roof = gableRoof(1.6, 1.3, 0.55, 0xd0623a, 2.0, 0.1);
	g.add(roof);
	const axle = part(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6), 0x6b4a32);
	axle.rotation.z = Math.PI / 2;
	axle.position.y = 1.55;
	g.add(axle);
	const bucket = part(new THREE.CylinderGeometry(0.16, 0.13, 0.24, 8), 0x8a5a33);
	bucket.position.set(0, 1.1, 0);
	g.add(bucket);
	return { group: g };
}

function buildMill() {
	const g = new THREE.Group();
	const tower = part(new THREE.CylinderGeometry(1.0, 1.4, 3.6, 8), 0xc8955a);
	tower.position.y = 1.8;
	g.add(tower);
	const cap = part(new THREE.ConeGeometry(1.25, 1.2, 8), 0x8a5a33);
	cap.position.y = 4.2;
	g.add(cap);
	g.add(boxAt(0.7, 1.2, 0.1, 0x5a3b22, 0, 0.6, 1.3));
	g.add(windowAt(0, 2.5, 1.12, 0.4, 0.4));
	const sails = new THREE.Group();
	sails.position.set(0, 3.6, 1.25);
	for (let i = 0; i < 4; i++) {
		const arm = new THREE.Group();
		arm.rotation.z = (i * Math.PI) / 2;
		arm.add(boxAt(0.08, 2.0, 0.06, 0x6b4a32, 0, 1.05, 0));
		arm.add(boxAt(0.5, 1.6, 0.04, 0xf3e6c8, 0.28, 1.2, 0.02));
		sails.add(arm);
	}
	const hub = part(new THREE.CylinderGeometry(0.16, 0.16, 0.2, 8), 0x4a3020);
	hub.rotation.x = Math.PI / 2;
	sails.add(hub);
	g.add(sails);
	return { group: g, sails };
}

const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfe8e0, transparent: true, opacity: 0.28, roughness: 0.1, flatShading: true, depthWrite: false });

function buildGreenhouse() {
	const g = new THREE.Group();
	const w = 4.2, d = 3.2, h = 2.0;
	g.add(boxAt(w + 0.1, 0.15, d + 0.1, 0xd8d2c4, 0, 0.075, 0));
	const frame = 0xf7f5ee;
	for (const x of [-w / 2, -w / 6, w / 6, w / 2]) {
		for (const z of [-d / 2, d / 2]) {
			// Leave the front middle open as a doorway.
			g.add(boxAt(0.08, h, 0.08, frame, x, h / 2, z));
		}
	}
	g.add(boxAt(w, 0.08, 0.08, frame, 0, h, d / 2));
	g.add(boxAt(w, 0.08, 0.08, frame, 0, h, -d / 2));
	g.add(boxAt(0.08, 0.08, d, frame, -w / 2, h, 0));
	g.add(boxAt(0.08, 0.08, d, frame, w / 2, h, 0));
	const back = part(new THREE.BoxGeometry(w, h, 0.04), glassMat, { cast: false });
	back.position.set(0, h / 2, -d / 2);
	const left = part(new THREE.BoxGeometry(0.04, h, d), glassMat, { cast: false });
	left.position.set(-w / 2, h / 2, 0);
	const right = left.clone();
	right.position.x = w / 2;
	g.add(back, left, right);
	for (const sx of [-1, 1]) {
		const front = part(new THREE.BoxGeometry(w / 3, h, 0.04), glassMat, { cast: false });
		front.position.set((sx * w) / 3, h / 2, d / 2);
		g.add(front);
	}
	// Roof: two glass slopes and a ridge.
	for (const s of [-1, 1]) {
		const slope = part(new THREE.BoxGeometry(w, 0.04, d * 0.58), glassMat, { cast: false });
		slope.position.set(0, h + 0.38, (s * d) / 4);
		slope.rotation.x = s * 0.5;
		g.add(slope);
	}
	g.add(boxAt(w + 0.1, 0.08, 0.1, frame, 0, h + 0.78, 0));
	return { group: g };
}

const BUILDERS = {
	coop: buildCoop, cowshed: buildCowshed, sheepfold: buildSheepfold, barn: buildBarn,
	well: buildWell, mill: buildMill, greenhouse: buildGreenhouse,
};

export function buildBuilding(id) {
	return BUILDERS[id]();
}

// Grandfather's old ruins on an unbuilt lot: broken stones and a sign post.
export function buildRuins(w, d) {
	const g = new THREE.Group();
	const n = Math.max(6, Math.round((w + d) * 1.6));
	for (let i = 0; i < n; i++) {
		const t = i / n;
		const perim = 2 * (w + d);
		let p = t * perim;
		let x, z;
		if (p < w) { x = -w / 2 + p; z = -d / 2; }
		else if ((p -= w) < d) { x = w / 2; z = -d / 2 + p; }
		else if ((p -= d) < w) { x = w / 2 - p; z = d / 2; }
		else { p -= w; x = -w / 2; z = d / 2 - p; }
		if (i % 4 === 3) continue;
		const s = part(new THREE.DodecahedronGeometry(0.18 + ((i * 37) % 10) / 70, 0), i % 3 ? 0x9a948a : 0x8a8478);
		s.position.set(x, 0.12, z);
		s.rotation.set(i, i * 2, 0);
		g.add(s);
	}
	for (let i = 0; i < 3; i++) {
		const plank = boxAt(0.9, 0.06, 0.18, 0x7a5a3a, -w / 4 + i * 0.5, 0.05, d / 6 - i * 0.3);
		plank.rotation.y = i * 0.9;
		g.add(plank);
	}
	return g;
}

// A sign showing a hammer: "something can be built here".
export function buildLotSign() {
	const g = new THREE.Group();
	g.add(boxAt(0.1, 1.0, 0.1, 0x8a5a33, 0, 0.5, 0));
	g.add(boxAt(0.7, 0.45, 0.06, 0xd9b77a, 0, 1.05, 0.04));
	g.add(boxAt(0.32, 0.08, 0.04, 0x5a3b22, 0, 1.12, 0.09));
	g.add(boxAt(0.08, 0.26, 0.04, 0x5a3b22, 0.06, 0.98, 0.09));
	return g;
}

// Scaffolding wrapped around a lot under construction.
export function buildScaffold(w, d, h) {
	const g = new THREE.Group();
	const c = 0xa77a46;
	const xs = [-w / 2 - 0.25, 0, w / 2 + 0.25];
	const zs = [-d / 2 - 0.25, d / 2 + 0.25];
	for (const x of xs) for (const z of zs) g.add(boxAt(0.09, h, 0.09, c, x, h / 2, z));
	for (const x of [-w / 2 - 0.25, w / 2 + 0.25]) g.add(boxAt(0.09, h, 0.09, c, x, h / 2, 0));
	for (const y of [h * 0.45, h * 0.9]) {
		for (const z of zs) g.add(boxAt(w + 0.6, 0.07, 0.36, 0xc8955a, 0, y, z));
		for (const x of [-w / 2 - 0.25, w / 2 + 0.25]) g.add(boxAt(0.07, 0.07, d + 0.5, c, x, y, 0));
	}
	// Lumber pile.
	for (let i = 0; i < 4; i++) g.add(boxAt(1.2, 0.12, 0.2, 0xc8955a, w / 2 + 0.9, 0.06 + i * 0.12, d / 2 + 0.4 - (i % 2) * 0.22));
	return g;
}

// ---- Plots and crops -----------------------------------------------------------------

export const soilDry = mat(0x8a5a3a);
export const soilWet = mat(0x5a3a26);

export function buildDebris(kind) {
	const g = new THREE.Group();
	if (kind === "stone") {
		const s = part(new THREE.DodecahedronGeometry(0.38, 0), 0x9a948a);
		s.scale.set(1.1, 0.7, 0.9);
		s.position.y = 0.2;
		const s2 = part(new THREE.DodecahedronGeometry(0.2, 0), 0x8a8478);
		s2.position.set(0.32, 0.12, 0.2);
		g.add(s, s2);
	} else if (kind === "stump") {
		const t = part(new THREE.CylinderGeometry(0.3, 0.38, 0.45, 8), 0x7a5232);
		t.position.y = 0.22;
		const top = part(new THREE.CylinderGeometry(0.29, 0.29, 0.02, 8), 0xd9b77a);
		top.position.y = 0.455;
		g.add(t, top);
	} else {
		for (let i = 0; i < 5; i++) {
			const b = part(new THREE.ConeGeometry(0.12, 0.5, 4), i % 2 ? 0x6a9a3a : 0x7fae44);
			b.position.set(Math.cos(i * 1.3) * 0.25, 0.25, Math.sin(i * 1.3) * 0.25);
			b.rotation.z = Math.cos(i) * 0.3;
			g.add(b);
		}
	}
	return g;
}

const LEAF = 0x5aa83a;
const LEAF_DARK = 0x3f8a2e;

function sprout(scale) {
	const g = new THREE.Group();
	for (let i = 0; i < 3; i++) {
		const l = part(new THREE.ConeGeometry(0.07, 0.3, 4), i % 2 ? LEAF : LEAF_DARK);
		l.position.set(Math.cos(i * 2.1) * 0.06, 0.15, Math.sin(i * 2.1) * 0.06);
		l.rotation.set(Math.sin(i * 2.1) * 0.5, 0, -Math.cos(i * 2.1) * 0.5);
		g.add(l);
	}
	g.scale.setScalar(scale);
	return g;
}

function leafyTop(count, len, color = LEAF) {
	const g = new THREE.Group();
	for (let i = 0; i < count; i++) {
		const a = (i / count) * Math.PI * 2;
		const l = part(new THREE.ConeGeometry(0.08, len, 4), i % 2 ? color : LEAF_DARK);
		l.position.set(Math.cos(a) * 0.08, len / 2, Math.sin(a) * 0.08);
		l.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
		g.add(l);
	}
	return g;
}

// stage: 0 seed, 1 sprout, 2 growing, 3 ripe
export function buildCrop(crop, stage) {
	const g = new THREE.Group();
	if (stage === 0) {
		const mound = part(new THREE.SphereGeometry(0.16, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0x6a4430);
		g.add(mound);
		for (let i = 0; i < 3; i++) {
			const s = part(new THREE.SphereGeometry(0.03, 4, 3), 0xe8d9a8);
			s.position.set(-0.06 + i * 0.06, 0.13, 0.03 * (i - 1));
			g.add(s);
		}
		return g;
	}
	if (stage === 1) {
		g.add(sprout(0.8));
		return g;
	}
	const ripe = stage === 3;
	switch (crop) {
		case "radish": {
			g.add(leafyTop(5, ripe ? 0.38 : 0.28));
			if (ripe) {
				const r = part(new THREE.IcosahedronGeometry(0.16, 1), 0xd9405a);
				r.position.y = 0.08;
				g.add(r);
			}
			break;
		}
		case "carrot": {
			const top = leafyTop(6, ripe ? 0.5 : 0.34);
			top.position.y = ripe ? 0.08 : 0;
			g.add(top);
			if (ripe) {
				const c = part(new THREE.ConeGeometry(0.13, 0.25, 6), 0xec7a2a);
				c.rotation.x = Math.PI;
				c.position.y = 0.06;
				g.add(c);
			}
			break;
		}
		case "potato": {
			const bush = part(new THREE.IcosahedronGeometry(ripe ? 0.34 : 0.24, 0), LEAF_DARK);
			bush.position.y = ripe ? 0.3 : 0.2;
			bush.scale.y = 0.8;
			g.add(bush);
			if (ripe) {
				for (let i = 0; i < 4; i++) {
					const f = part(new THREE.SphereGeometry(0.05, 5, 4), 0xf3e6f5);
					f.position.set(Math.cos(i * 1.7) * 0.22, 0.48, Math.sin(i * 1.7) * 0.22);
					g.add(f);
				}
				const p = part(new THREE.DodecahedronGeometry(0.11, 0), 0xb8864a);
				p.position.set(0.24, 0.06, 0.18);
				g.add(p);
			}
			break;
		}
		case "wheat": {
			const color = ripe ? 0xe8c25a : 0x9cc24a;
			for (let i = 0; i < 7; i++) {
				const a = i * 0.9;
				const r = i === 0 ? 0 : 0.18;
				const h = ripe ? 0.8 : 0.5;
				const stalk = part(new THREE.CylinderGeometry(0.015, 0.02, h, 4), color);
				stalk.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
				g.add(stalk);
				if (ripe) {
					const ear = part(new THREE.ConeGeometry(0.05, 0.22, 5), 0xf0cf6a);
					ear.rotation.x = Math.PI;
					ear.position.set(Math.cos(a) * r, h + 0.08, Math.sin(a) * r);
					g.add(ear);
				}
			}
			break;
		}
		case "sunflower": {
			const h = ripe ? 1.5 : 0.8;
			const stem = part(new THREE.CylinderGeometry(0.04, 0.05, h, 5), LEAF_DARK);
			stem.position.y = h / 2;
			g.add(stem);
			for (const s of [-1, 1]) {
				const leaf = part(new THREE.ConeGeometry(0.1, 0.35, 4), LEAF);
				leaf.position.set(s * 0.15, h * 0.45, 0);
				leaf.rotation.z = -s * 1.1;
				g.add(leaf);
			}
			if (ripe) {
				const head = new THREE.Group();
				head.position.set(0, h, 0.06);
				head.rotation.x = 0.35;
				const petals = part(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 12), 0xf6c522);
				petals.rotation.x = Math.PI / 2;
				const disc = part(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10), 0x6b3f1e);
				disc.rotation.x = Math.PI / 2;
				disc.position.z = 0.02;
				head.add(petals, disc);
				g.add(head);
			}
			break;
		}
		case "pumpkin": {
			for (let i = 0; i < 4; i++) {
				const leaf = part(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 6), LEAF);
				leaf.position.set(Math.cos(i * 1.6) * 0.3, 0.06 + i * 0.02, Math.sin(i * 1.6) * 0.3);
				leaf.rotation.set(0.2, 0, 0.2);
				g.add(leaf);
			}
			const size = ripe ? 0.36 : 0.14;
			const p = part(new THREE.SphereGeometry(size, 10, 7), ripe ? 0xe8822a : 0x9cc24a);
			p.scale.y = 0.72;
			p.position.y = size * 0.7;
			g.add(p);
			if (ripe) {
				const stem = part(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 5), 0x6b4a2a);
				stem.position.y = size * 1.4;
				g.add(stem);
			}
			break;
		}
		default:
			g.add(sprout(1.2));
	}
	return g;
}

// ---- Decor -----------------------------------------------------------------------------

export const lanternGlow = new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffb84a, emissiveIntensity: 0.2, flatShading: true });

export function buildDecor(kind, foliageMat) {
	const g = new THREE.Group();
	switch (kind) {
		case "fence": {
			for (const x of [-0.75, 0, 0.75]) g.add(boxAt(0.12, 0.85, 0.12, 0x9a6a3c, x, 0.42, 0));
			for (const y of [0.35, 0.65]) g.add(boxAt(1.65, 0.1, 0.06, 0xb07a44, 0, y, 0.06));
			break;
		}
		case "flowerbed": {
			const ring = part(new THREE.CylinderGeometry(0.62, 0.62, 0.22, 12), 0x9a6a3c);
			ring.position.y = 0.11;
			const soil = part(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 12), 0x5a3a26);
			soil.position.y = 0.22;
			g.add(ring, soil);
			const colors = [0xf28ab0, 0xf6e04a, 0xffffff, 0xf28ab0, 0xc87ae0, 0xf6e04a, 0xffffff];
			colors.forEach((c, i) => {
				const a = i * 0.9;
				const r = i === 0 ? 0 : 0.34;
				const stem = part(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 4), LEAF_DARK);
				stem.position.set(Math.cos(a) * r, 0.33, Math.sin(a) * r);
				const f = part(new THREE.IcosahedronGeometry(0.08, 0), c);
				f.position.set(Math.cos(a) * r, 0.45, Math.sin(a) * r);
				g.add(stem, f);
			});
			break;
		}
		case "scarecrow": {
			g.add(boxAt(0.1, 1.7, 0.1, 0x8a5a33, 0, 0.85, 0));
			g.add(boxAt(1.2, 0.08, 0.08, 0x8a5a33, 0, 1.25, 0));
			g.add(boxAt(0.5, 0.6, 0.3, 0x4a78b8, 0, 1.15, 0));
			for (const s of [-1, 1]) g.add(boxAt(0.4, 0.18, 0.18, 0x4a78b8, s * 0.42, 1.27, 0));
			const head = part(new THREE.SphereGeometry(0.2, 7, 6), 0xe8c27a);
			head.position.y = 1.68;
			g.add(head);
			const brim = part(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 10), 0xe8c04a);
			brim.position.y = 1.82;
			const crown = part(new THREE.CylinderGeometry(0.16, 0.2, 0.18, 8), 0xe8c04a);
			crown.position.y = 1.92;
			g.add(brim, crown);
			g.add(boxAt(0.14, 0.14, 0.04, 0xd0623a, 0.12, 1.05, 0.16));
			break;
		}
		case "lantern": {
			g.add(boxAt(0.12, 1.8, 0.12, 0x6b4a32, 0, 0.9, 0));
			g.add(boxAt(0.55, 0.08, 0.08, 0x6b4a32, 0.22, 1.75, 0));
			const lamp = part(new THREE.BoxGeometry(0.22, 0.28, 0.22), lanternGlow, { cast: false });
			lamp.position.set(0.42, 1.52, 0);
			const top = part(new THREE.ConeGeometry(0.18, 0.14, 4), 0x3a3330);
			top.position.set(0.42, 1.73, 0);
			top.rotation.y = Math.PI / 4;
			g.add(lamp, top);
			break;
		}
		case "bench": {
			g.add(boxAt(1.4, 0.07, 0.45, 0xb07a44, 0, 0.45, 0));
			g.add(boxAt(1.4, 0.35, 0.06, 0xb07a44, 0, 0.75, -0.2));
			for (const x of [-0.6, 0.6]) for (const z of [-0.18, 0.18]) g.add(boxAt(0.08, 0.45, 0.08, 0x8a5a33, x, 0.22, z));
			break;
		}
		case "birch": {
			const trunk = part(new THREE.CylinderGeometry(0.1, 0.13, 1.6, 6), 0xf3f0e8);
			trunk.position.y = 0.8;
			g.add(trunk);
			for (const y of [0.4, 0.9, 1.3]) g.add(boxAt(0.14, 0.04, 0.27, 0x3a3330, 0.05, y, 0));
			const crown = part(new THREE.IcosahedronGeometry(0.7, 0), foliageMat);
			crown.position.y = 2.0;
			crown.scale.set(0.9, 1.15, 0.9);
			crown.userData.foliage = true;
			g.add(crown);
			break;
		}
	}
	return g;
}

// A flat ring under the current interaction target.
export function buildTargetRing() {
	const ring = new THREE.Mesh(
		new THREE.RingGeometry(0.55, 0.68, 28),
		new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.85, depthWrite: false }),
	);
	ring.rotation.x = -Math.PI / 2;
	ring.position.y = 0.03;
	ring.renderOrder = 2;
	return ring;
}
