// Shared builder for every villager model. Each src/models/<name>.js calls it
// with a look; the game loads the exported GLB and swings the named limbs
// (leg_left, leg_right, arm_left, arm_right) and nods the "head" group.
// Origin at the centre of the feet, facing +Z, sizes in metres.
import * as THREE from "three";
import * as kit from "../lib/scene3d.js";

const FLAT = { flatShading: true, roughness: 0.85 };

function mat(color) {
	return new THREE.MeshStandardMaterial({ color, ...FLAT });
}

function mesh(geometry, color) {
	const m = new THREE.Mesh(geometry, mat(color));
	m.castShadow = true;
	m.receiveShadow = true;
	return m;
}

// Upper part of a sphere (a cap), used for hair, caps and scarves.
function cap(radius, color, thetaLength = Math.PI * 0.55) {
	return mesh(new THREE.SphereGeometry(radius, 12, 8, 0, Math.PI * 2, 0, thetaLength), color);
}

export function buildPerson(look) {
	const o = {
		skin: 0xf1c27d,
		shirt: 0xf4efe4,
		pants: 0x3f6fb5,
		shoes: 0x5a3b22,
		hair: 0x6b4423,
		hairStyle: "short",
		hat: "none",
		hatColor: 0xe8c04a,
		beard: "none",
		beardColor: null,
		overalls: false,
		dress: null,
		apron: false,
		coat: null,
		vest: null,
		glasses: false,
		scale: 1,
		...look,
	};
	const beardColor = o.beardColor ?? o.hair;
	const root = new THREE.Group();
	root.name = o.name || "person";

	// Legs: hip pivots at 0.74 m; shoes ride inside the joint so they swing too.
	const legLen = 0.66;
	for (const side of [-1, 1]) {
		const leg = kit.jointedLimb({ length: legLen, radius: 0.095, color: o.pants, ...FLAT });
		leg.joint.name = side < 0 ? "leg_left" : "leg_right";
		leg.joint.position.set(side * 0.12, 0.74, 0);
		const shoe = mesh(new THREE.BoxGeometry(0.16, 0.08, 0.24), o.shoes);
		shoe.position.set(0, -legLen - 0.04, 0.03);
		leg.joint.add(shoe);
		root.add(leg.joint);
	}

	// Torso.
	const torso = mesh(new THREE.BoxGeometry(0.5, 0.56, 0.32), o.shirt);
	torso.name = "torso";
	torso.position.y = 1.0;
	root.add(torso);

	if (o.overalls) {
		const lower = mesh(new THREE.BoxGeometry(0.52, 0.24, 0.34), o.pants);
		lower.position.set(0, 0.84, 0);
		const bib = mesh(new THREE.BoxGeometry(0.3, 0.24, 0.03), o.pants);
		bib.position.set(0, 1.06, 0.17);
		root.add(lower, bib);
		for (const side of [-1, 1]) {
			const strap = mesh(new THREE.BoxGeometry(0.06, 0.34, 0.34), o.pants);
			strap.position.set(side * 0.13, 1.13, 0);
			const button = mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), 0xd8b24a);
			button.position.set(side * 0.13, 1.16, 0.19);
			root.add(strap, button);
		}
	}
	if (o.dress) {
		const skirt = mesh(new THREE.CylinderGeometry(0.27, 0.4, 0.52, 10), o.dress);
		skirt.position.y = 0.6;
		root.add(skirt);
	}
	if (o.coat) {
		const coat = mesh(new THREE.CylinderGeometry(0.29, 0.34, 0.8, 10), o.coat);
		coat.position.y = 0.92;
		root.add(coat);
	}
	if (o.vest) {
		const vest = mesh(new THREE.BoxGeometry(0.52, 0.42, 0.34), o.vest);
		vest.position.set(0, 1.04, 0);
		root.add(vest);
		const collar = mesh(new THREE.BoxGeometry(0.16, 0.14, 0.02), o.shirt);
		collar.position.set(0, 1.18, 0.175);
		root.add(collar);
	}
	if (o.apron) {
		const apron = mesh(new THREE.BoxGeometry(0.36, 0.62, 0.02), 0xf7f3ea);
		apron.position.set(0, 0.72, 0.36);
		apron.rotation.x = -0.12;
		root.add(apron);
	}

	// Arms: shoulder pivots; hands are skin spheres at the far end.
	const armLen = 0.5;
	const sleeve = o.coat ?? o.shirt;
	for (const side of [-1, 1]) {
		const arm = kit.jointedLimb({ length: armLen, radius: 0.075, color: sleeve, ...FLAT });
		arm.joint.name = side < 0 ? "arm_left" : "arm_right";
		arm.joint.position.set(side * 0.33, 1.24, 0);
		arm.joint.rotation.z = side * 0.08;
		const hand = mesh(new THREE.SphereGeometry(0.075, 8, 6), o.skin);
		hand.position.y = -armLen - 0.03;
		arm.joint.add(hand);
		root.add(arm.joint);
	}

	// Head group: everything above the neck nods together.
	const head = new THREE.Group();
	head.name = "head";
	head.position.y = 1.52;
	root.add(head);
	const skull = mesh(new THREE.SphereGeometry(0.25, 12, 10), o.skin);
	head.add(skull);
	const nose = mesh(new THREE.SphereGeometry(0.045, 6, 5), o.skin);
	nose.position.set(0, -0.04, 0.245);
	head.add(nose);
	for (const side of [-1, 1]) {
		const eye = mesh(new THREE.SphereGeometry(0.034, 6, 5), 0x2a1d14);
		eye.position.set(side * 0.09, 0.02, 0.225);
		head.add(eye);
		const ear = mesh(new THREE.SphereGeometry(0.05, 6, 5), o.skin);
		ear.position.set(side * 0.25, -0.01, 0);
		head.add(ear);
		if (o.glasses) {
			const rim = mesh(new THREE.TorusGeometry(0.055, 0.012, 5, 10), 0xc8a24a);
			rim.position.set(side * 0.09, 0.02, 0.24);
			head.add(rim);
		}
	}

	// Hair.
	if (o.hairStyle !== "bald") {
		const hair = cap(0.265, o.hair, Math.PI * 0.5);
		hair.rotation.x = -0.35;
		hair.position.y = 0.01;
		head.add(hair);
	}
	if (o.hairStyle === "braid") {
		for (let i = 0; i < 5; i++) {
			const knot = mesh(new THREE.SphereGeometry(0.075 - i * 0.006, 7, 5), o.hair);
			knot.position.set(0.12, -0.1 - i * 0.11, -0.2 + i * 0.01);
			head.add(knot);
		}
	}
	if (o.hairStyle === "bob") {
		const back = mesh(new THREE.BoxGeometry(0.54, 0.3, 0.3), o.hair);
		back.position.set(0, -0.06, -0.1);
		head.add(back);
	}
	if (o.hairStyle === "curly") {
		for (const [x, y, z] of [[-0.14, 0.18, 0.06], [0.14, 0.18, 0.06], [0, 0.22, -0.02], [-0.18, 0.1, -0.12], [0.18, 0.1, -0.12], [0, 0.12, -0.2]]) {
			const curl = mesh(new THREE.SphereGeometry(0.1, 7, 5), o.hair);
			curl.position.set(x, y, z);
			head.add(curl);
		}
	}

	// Beards.
	if (o.beard === "full") {
		const beard = mesh(new THREE.SphereGeometry(0.2, 9, 7), beardColor);
		beard.scale.set(1.1, 1, 0.8);
		beard.position.set(0, -0.17, 0.11);
		head.add(beard);
	}
	if (o.beard === "full" || o.beard === "moustache") {
		const moustache = mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), beardColor);
		moustache.position.set(0, -0.09, 0.235);
		head.add(moustache);
	}
	if (o.beard === "stubble") {
		const stubble = cap(0.252, beardColor, Math.PI * 0.32);
		stubble.rotation.x = Math.PI - 0.5;
		head.add(stubble);
	}

	// Hats.
	if (o.hat === "straw") {
		const brim = mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.03, 14), o.hatColor);
		brim.position.y = 0.15;
		const crown = mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.2, 12), o.hatColor);
		crown.position.y = 0.26;
		const band = mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.05, 12), 0xb5652b);
		band.position.y = 0.19;
		head.add(brim, crown, band);
	}
	if (o.hat === "cap" || o.hat === "capBack") {
		const dome = cap(0.275, o.hatColor, Math.PI * 0.5);
		dome.position.y = 0.04;
		const visor = mesh(new THREE.BoxGeometry(0.3, 0.03, 0.2), o.hatColor);
		visor.position.set(0, 0.06, o.hat === "cap" ? 0.3 : -0.3);
		head.add(dome, visor);
	}
	if (o.hat === "hardhat") {
		const dome = cap(0.29, o.hatColor, Math.PI * 0.5);
		dome.position.y = 0.04;
		const brim = mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.03, 14), o.hatColor);
		brim.position.y = 0.05;
		head.add(dome, brim);
	}
	if (o.hat === "scarf") {
		const scarf = cap(0.285, o.hatColor, Math.PI * 0.62);
		scarf.rotation.x = -0.25;
		const knot = mesh(new THREE.SphereGeometry(0.07, 7, 5), o.hatColor);
		knot.position.set(0, -0.26, 0.15);
		const tail = mesh(new THREE.ConeGeometry(0.14, 0.24, 4), o.hatColor);
		tail.position.set(0, -0.2, -0.22);
		tail.rotation.x = Math.PI + 0.3;
		head.add(scarf, knot, tail);
	}

	root.scale.setScalar(o.scale);
	return root;
}
