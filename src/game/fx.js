// Particles in the world: bursts for actions (dirt, drops, sparks, hearts,
// coins) and the season's ambient fall (petals, leaves, snow, rain).
// Purely visual; stepped from update() with dt.
import * as THREE from "three";

const KINDS = {
	dirt: { geo: new THREE.BoxGeometry(0.09, 0.09, 0.09), color: 0x7a4e32, up: 2.6, spread: 1.4, g: 9, life: 0.7 },
	leaf: { geo: new THREE.BoxGeometry(0.12, 0.02, 0.07), color: 0x6aa83a, up: 2.8, spread: 1.6, g: 6, life: 0.9 },
	stone: { geo: new THREE.DodecahedronGeometry(0.06, 0), color: 0x9a948a, up: 3, spread: 1.6, g: 10, life: 0.6 },
	wood: { geo: new THREE.BoxGeometry(0.14, 0.04, 0.05), color: 0xd9b77a, up: 3, spread: 1.8, g: 10, life: 0.7 },
	drop: { geo: new THREE.SphereGeometry(0.045, 5, 4), color: 0x5ab4f0, up: 1.6, spread: 1.1, g: 9, life: 0.6 },
	spark: { geo: new THREE.OctahedronGeometry(0.07, 0), color: 0xffe066, up: 3.2, spread: 1.2, g: 4, life: 0.8, glow: true },
	heart: { geo: new THREE.OctahedronGeometry(0.09, 0), color: 0xff5c7a, up: 1.8, spread: 0.5, g: -0.5, life: 1.1, glow: true },
	coin: { geo: new THREE.CylinderGeometry(0.09, 0.09, 0.025, 10), color: 0xf6c12a, up: 4, spread: 1.6, g: 9, life: 1.0, glow: true },
	flour: { geo: new THREE.SphereGeometry(0.05, 4, 3), color: 0xf8f4ea, up: 1.2, spread: 1.5, g: 1, life: 1.0 },
};

const AMBIENT = {
	spring: { color: 0xffc4dc, geo: new THREE.BoxGeometry(0.08, 0.01, 0.06), fall: 0.6, sway: 1.2, n: 26 },
	summer: { color: 0xfff3a0, geo: new THREE.OctahedronGeometry(0.03, 0), fall: -0.05, sway: 0.6, n: 14, glow: true },
	autumn: { color: 0xe8862a, geo: new THREE.BoxGeometry(0.12, 0.01, 0.08), fall: 0.8, sway: 1.5, n: 30 },
	winter: { color: 0xffffff, geo: new THREE.SphereGeometry(0.05, 4, 3), fall: 1.1, sway: 0.6, n: 60 },
	rain: { color: 0x9fd0f5, geo: new THREE.BoxGeometry(0.02, 0.4, 0.02), fall: 14, sway: 0, n: 90 },
};

export function createFx(scene) {
	const mats = {};
	for (const [k, d] of Object.entries(KINDS)) {
		mats[k] = new THREE.MeshStandardMaterial({ color: d.color, flatShading: true, emissive: d.glow ? d.color : 0x000000, emissiveIntensity: d.glow ? 0.5 : 0 });
	}
	const pool = [];
	const live = [];
	function get(kind) {
		let m = pool.pop();
		if (!m) {
			m = new THREE.Mesh(KINDS[kind].geo, mats[kind]);
			m.castShadow = false;
			scene.add(m);
		}
		m.geometry = KINDS[kind].geo;
		m.material = mats[kind];
		m.visible = true;
		return m;
	}

	function burst(x, y, z, kind, n = 10) {
		const d = KINDS[kind] || KINDS.spark;
		for (let i = 0; i < n && live.length < 260; i++) {
			const m = get(kind in KINDS ? kind : "spark");
			const a = Math.random() * Math.PI * 2;
			const s = d.spread * (0.4 + Math.random() * 0.6);
			m.position.set(x + Math.cos(a) * 0.15, y, z + Math.sin(a) * 0.15);
			live.push({ m, vx: Math.cos(a) * s, vy: d.up * (0.6 + Math.random() * 0.6), vz: Math.sin(a) * s, g: d.g, life: d.life * (0.7 + Math.random() * 0.5), t: 0, spin: (Math.random() - 0.5) * 12 });
		}
	}

	// Ambient particles live in a box around the camera target.
	const ambMeshes = {};
	const ambMats = {};
	for (const [k, d] of Object.entries(AMBIENT)) {
		ambMats[k] = new THREE.MeshStandardMaterial({ color: d.color, flatShading: true, transparent: k === "rain", opacity: k === "rain" ? 0.6 : 1, emissive: d.glow ? d.color : 0, emissiveIntensity: d.glow ? 1 : 0 });
		const list = [];
		for (let i = 0; i < d.n; i++) {
			const m = new THREE.Mesh(d.geo, ambMats[k]);
			m.visible = false;
			m.userData = { ox: (Math.random() - 0.5) * 30, oy: Math.random() * 9, oz: (Math.random() - 0.5) * 26, ph: Math.random() * 6 };
			scene.add(m);
			list.push(m);
		}
		ambMeshes[k] = list;
	}
	let clock = 0;

	function update(dt, center, season, raining) {
		clock += dt;
		for (let i = live.length - 1; i >= 0; i--) {
			const p = live[i];
			p.t += dt;
			if (p.t >= p.life) {
				p.m.visible = false;
				pool.push(p.m);
				live.splice(i, 1);
				continue;
			}
			p.vy -= p.g * dt;
			p.m.position.x += p.vx * dt;
			p.m.position.y = Math.max(0.02, p.m.position.y + p.vy * dt);
			p.m.position.z += p.vz * dt;
			p.m.rotation.x += p.spin * dt;
			p.m.rotation.y += p.spin * dt * 0.7;
			const k = 1 - Math.max(0, (p.t - p.life * 0.6) / (p.life * 0.4));
			p.m.scale.setScalar(Math.max(0.05, k));
		}
		for (const [k, list] of Object.entries(ambMeshes)) {
			const on = k === "rain" ? raining : k === season;
			const d = AMBIENT[k];
			for (const m of list) {
				m.visible = on;
				if (!on) continue;
				const u = m.userData;
				u.oy -= d.fall * dt;
				if (u.oy < 0) u.oy += 9;
				if (u.oy > 9) u.oy -= 9;
				m.position.set(center.x + u.ox + Math.sin(clock * d.sway + u.ph) * 0.6, u.oy, center.z + u.oz);
				if (k !== "rain") {
					m.rotation.x = clock * 2 + u.ph;
					m.rotation.z = clock * 1.3 + u.ph;
				}
			}
		}
	}

	return { burst, update };
}
