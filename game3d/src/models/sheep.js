// Овца: origin at the hooves, facing +Z. The game swings the legs and nods "head".
import * as THREE from "three";

function part(geometry, color) {
	const m = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95 }));
	m.castShadow = m.receiveShadow = true;
	return m;
}

export default function build() {
	const root = new THREE.Group();
	root.name = "sheep";
	const wool = 0xf4ecd8;
	const dark = 0x3a3330;
	const body = new THREE.Group();
	body.name = "body";
	root.add(body);
	for (const [x, y, z, r] of [[0, 0.68, 0, 0.34], [0.18, 0.7, 0.22, 0.24], [-0.18, 0.7, 0.22, 0.24], [0.18, 0.7, -0.24, 0.24], [-0.18, 0.7, -0.24, 0.24], [0, 0.9, 0.05, 0.24], [0, 0.66, -0.36, 0.22]]) {
		const puff = part(new THREE.IcosahedronGeometry(r, 0), wool);
		puff.position.set(x, y, z);
		body.add(puff);
	}
	for (const [name, x, z] of [["leg_fl", -0.16, 0.24], ["leg_fr", 0.16, 0.24], ["leg_bl", -0.16, -0.26], ["leg_br", 0.16, -0.26]]) {
		const joint = new THREE.Group();
		joint.name = name;
		joint.position.set(x, 0.42, z);
		const leg = part(new THREE.BoxGeometry(0.09, 0.42, 0.09), dark);
		leg.position.y = -0.21;
		joint.add(leg);
		root.add(joint);
	}
	const head = new THREE.Group();
	head.name = "head";
	head.position.set(0, 0.85, 0.42);
	root.add(head);
	const face = part(new THREE.BoxGeometry(0.24, 0.28, 0.26), dark);
	face.position.z = 0.06;
	const tuft = part(new THREE.IcosahedronGeometry(0.13, 0), wool);
	tuft.position.set(0, 0.15, 0.02);
	head.add(face, tuft);
	for (const side of [-1, 1]) {
		const ear = part(new THREE.BoxGeometry(0.16, 0.05, 0.08), dark);
		ear.position.set(side * 0.17, 0.06, 0);
		ear.rotation.z = side * -0.3;
		const eye = part(new THREE.SphereGeometry(0.025, 5, 4), 0xf5f0e6);
		eye.position.set(side * 0.08, 0.04, 0.19);
		head.add(ear, eye);
	}
	return root;
}


