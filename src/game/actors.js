// Library models (villagers and animals): loaded once as GLB, cloned per use,
// and posed by swinging their named limbs. The outer group is placed by the
// game; poses only touch the parts inside it.
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const MODEL_KEYS = [
	"HERO_MAX_MODEL", "HERO_MASHA_MODEL", "NYURA_MODEL", "ASHOT_MODEL", "SENYA_MODEL", "VIKA_MODEL",
	"FIL_MODEL", "PETROVICH_MODEL", "GOSHA_MODEL", "CHICKEN_MODEL", "COW_MODEL", "SHEEP_MODEL",
];

export async function loadModels(assets) {
	const loader = new GLTFLoader();
	const entries = await Promise.all(
		MODEL_KEYS.map(async (key) => {
			const gltf = await loader.loadAsync(assets.get(key));
			gltf.scene.traverse((o) => {
				if (o.isMesh) {
					o.castShadow = true;
					o.receiveShadow = true;
					// The GLB keeps flat shading as normals; keep the material matte.
					if (o.material) o.material.roughness = 0.85;
				}
			});
			return [key, gltf.scene];
		}),
	);
	return Object.fromEntries(entries);
}

// A posable copy: { root, parts } where parts are the named limbs.
export function spawn(models, key) {
	const root = models[key].clone(true);
	const find = (n) => root.getObjectByName(n) || null;
	return {
		root,
		parts: {
			legL: find("leg_left"), legR: find("leg_right"), armL: find("arm_left"), armR: find("arm_right"),
			head: find("head"), wingL: find("wing_left"), wingR: find("wing_right"),
			fl: find("leg_fl"), fr: find("leg_fr"), bl: find("leg_bl"), br: find("leg_br"), body: find("body"),
		},
	};
}

// Biped pose. phase advances with distance walked; action: null | "work" | "water" | "fish" | "wave".
export function poseBiped(actor, { walk = 0, phase = 0, action = null, actionT = 0, time = 0 }) {
	const p = actor.parts;
	const swing = Math.sin(phase) * 0.7 * walk;
	if (p.legL) p.legL.rotation.x = swing;
	if (p.legR) p.legR.rotation.x = -swing;
	let al = -swing * 0.8;
	let ar = swing * 0.8;
	let headX = Math.sin(time * 1.3) * 0.03;
	if (action === "work") {
		// Hammering: right arm chops down repeatedly.
		ar = -1.6 + Math.abs(Math.sin(actionT * 7)) * 1.3;
		al = -0.3;
		headX = 0.25;
	} else if (action === "water") {
		ar = -1.1;
		al = -0.2;
		headX = 0.3;
	} else if (action === "harvest") {
		const k = Math.sin(Math.min(1, actionT * 3) * Math.PI);
		ar = -1.2 * k;
		al = -1.2 * k;
		headX = 0.35 * k;
	} else if (action === "fish") {
		ar = -1.3;
		al = -1.3;
		headX = 0.15;
	} else if (action === "wave") {
		ar = Math.PI - 0.4 + Math.sin(time * 9) * 0.35;
	}
	if (p.armL) p.armL.rotation.x = al;
	if (p.armR) p.armR.rotation.x = ar;
	if (p.head) p.head.rotation.x = headX;
}

export function poseQuadruped(actor, { walk = 0, phase = 0, time = 0, graze = 0 }) {
	const p = actor.parts;
	const s = Math.sin(phase) * 0.5 * walk;
	if (p.fl) p.fl.rotation.x = s;
	if (p.br) p.br.rotation.x = s;
	if (p.fr) p.fr.rotation.x = -s;
	if (p.bl) p.bl.rotation.x = -s;
	if (p.head) p.head.rotation.x = graze * 0.6 + Math.sin(time * 1.1) * 0.05;
}

export function poseChicken(actor, { walk = 0, phase = 0, time = 0, peck = 0 }) {
	const p = actor.parts;
	if (p.head) p.head.rotation.x = peck > 0 ? Math.abs(Math.sin(peck * 10)) * 0.9 : Math.sin(phase * 2) * 0.15 * walk;
	const flap = walk > 0.5 ? Math.sin(time * 18) * 0.3 : 0;
	if (p.wingL) p.wingL.rotation.z = flap;
	if (p.wingR) p.wingR.rotation.z = -flap;
	if (p.body) p.body.position.y = 0.3 + Math.abs(Math.sin(phase)) * 0.03 * walk;
}
