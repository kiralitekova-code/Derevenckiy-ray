// Курица: origin at the feet, facing +Z. The game bobs "head" and flaps the wings.
import * as THREE from "three";

function part(geometry, color) {
	const m = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 }));
	m.castShadow = m.receiveShadow = true;
	return m;
}

export default function build() {
	const root = new THREE.Group();
	root.name = "chicken";
	const body = part(new THREE.SphereGeometry(0.2, 8, 6), 0xfaf6ee);
	body.name = "body";
	body.scale.set(1, 0.9, 1.2);
	body.position.y = 0.3;
	root.add(body);
	const tail = part(new THREE.ConeGeometry(0.1, 0.2, 5), 0xf2ede2);
	tail.position.set(0, 0.42, -0.22);
	tail.rotation.x = -0.7;
	root.add(tail);
	for (const side of [-1, 1]) {
		const wing = part(new THREE.SphereGeometry(0.12, 6, 5), 0xece6d8);
		wing.name = side < 0 ? "wing_left" : "wing_right";
		wing.scale.set(0.35, 0.7, 1.1);
		wing.position.set(side * 0.19, 0.31, -0.02);
		root.add(wing);
		const leg = part(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 5), 0xf0a032);
		leg.position.set(side * 0.07, 0.07, 0.02);
		const foot = part(new THREE.BoxGeometry(0.07, 0.015, 0.08), 0xf0a032);
		foot.position.set(side * 0.07, 0.008, 0.04);
		root.add(leg, foot);
	}
	const head = new THREE.Group();
	head.name = "head";
	head.position.set(0, 0.5, 0.15);
	root.add(head);
	head.add(part(new THREE.SphereGeometry(0.1, 8, 6), 0xfaf6ee));
	const beak = part(new THREE.ConeGeometry(0.035, 0.08, 5), 0xf2a22e);
	beak.rotation.x = Math.PI / 2;
	beak.position.set(0, -0.01, 0.12);
	const comb = part(new THREE.BoxGeometry(0.03, 0.08, 0.1), 0xd8342b);
	comb.position.set(0, 0.11, 0.01);
	const wattle = part(new THREE.SphereGeometry(0.025, 5, 4), 0xd8342b);
	wattle.position.set(0, -0.07, 0.09);
	head.add(beak, comb, wattle);
	for (const side of [-1, 1]) {
		const eye = part(new THREE.SphereGeometry(0.016, 5, 4), 0x1d140e);
		eye.position.set(side * 0.06, 0.02, 0.07);
		head.add(eye);
	}
	return root;
}


