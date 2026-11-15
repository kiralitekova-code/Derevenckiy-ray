// Корова: origin at the hooves, facing +Z. The game swings the four legs and nods "head".
import * as THREE from "three";

function part(geometry, color) {
	const m = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 }));
	m.castShadow = m.receiveShadow = true;
	return m;
}

export default function build() {
	const root = new THREE.Group();
	root.name = "cow";
	const brown = 0x9a5a32;
	const white = 0xf5efe3;
	const body = part(new THREE.BoxGeometry(0.85, 0.72, 1.55), brown);
	body.name = "body";
	body.position.y = 1.0;
	root.add(body);
	for (const [x, y, z, w, h, d] of [[0.43, 1.05, 0.2, 0.02, 0.4, 0.5], [-0.43, 0.95, -0.35, 0.02, 0.38, 0.45], [0, 1.365, -0.2, 0.5, 0.02, 0.5]]) {
		const spot = part(new THREE.BoxGeometry(w, h, d), white);
		spot.position.set(x, y, z);
		root.add(spot);
	}
	const legs = [["leg_fl", -0.28, 0.58], ["leg_fr", 0.28, 0.58], ["leg_bl", -0.28, -0.58], ["leg_br", 0.28, -0.58]];
	for (const [name, x, z] of legs) {
		const joint = new THREE.Group();
		joint.name = name;
		joint.position.set(x, 0.7, z);
		const leg = part(new THREE.BoxGeometry(0.18, 0.62, 0.18), brown);
		leg.position.y = -0.31;
		const hoof = part(new THREE.BoxGeometry(0.2, 0.1, 0.2), 0x3a2a20);
		hoof.position.y = -0.65;
		joint.add(leg, hoof);
		root.add(joint);
	}
	const udder = part(new THREE.SphereGeometry(0.15, 7, 5), 0xf2a6a6);
	udder.position.set(0, 0.62, -0.3);
	root.add(udder);
	const tail = part(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 5), brown);
	tail.position.set(0, 1.05, -0.8);
	tail.rotation.x = 0.25;
	root.add(tail);
	const head = new THREE.Group();
	head.name = "head";
	head.position.set(0, 1.25, 0.9);
	root.add(head);
	const skull = part(new THREE.BoxGeometry(0.5, 0.48, 0.5), white);
	head.add(skull);
	const patch = part(new THREE.BoxGeometry(0.52, 0.22, 0.3), brown);
	patch.position.set(0, 0.16, -0.08);
	const muzzle = part(new THREE.BoxGeometry(0.44, 0.26, 0.18), 0xf3a5a2);
	muzzle.position.set(0, -0.12, 0.3);
	head.add(patch, muzzle);
	for (const side of [-1, 1]) {
		const horn = part(new THREE.ConeGeometry(0.05, 0.18, 5), 0xf0e2c0);
		horn.position.set(side * 0.2, 0.32, -0.05);
		horn.rotation.z = -side * 0.4;
		const ear = part(new THREE.BoxGeometry(0.2, 0.08, 0.12), brown);
		ear.position.set(side * 0.33, 0.12, -0.05);
		const eye = part(new THREE.SphereGeometry(0.035, 5, 4), 0x1d140e);
		eye.position.set(side * 0.14, 0.06, 0.25);
		const nostril = part(new THREE.SphereGeometry(0.025, 4, 3), 0x8a4a48);
		nostril.position.set(side * 0.1, -0.1, 0.4);
		head.add(horn, ear, eye, nostril);
	}
	return root;
}
