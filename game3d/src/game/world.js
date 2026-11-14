// 3D-мир: тёплый лоу-поли. Вся геометрия процедурная, палитра — как на референсах.

import * as THREE from "three";

export const PALETTE = {
  grass: 0x8fbf5a, grassDry: 0xc2b060, snow: 0xeef2f4,
  path: 0xb08a5a, water: 0x5ab4f0, sand: 0xd8c290,
  wood: 0x8a5a30, woodDark: 0x6a4020, roof: 0xd8703a, roofAlt: 0xb85838,
  wall: 0xf0e0c0, wallAlt: 0xe8d0a8, stone: 0x9a9a92, leaf: 0x5ea84a, leafAutumn: 0xd89030,
  birchBark: 0xe8e8e0, soil: 0x6a4a2e, soilWet: 0x4e341e,
};

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, ...opts });
const box = (w, h, d, color) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
};
const cyl = (rt, rb, h, color, seg = 8) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
};
const cone = (r, h, color, seg = 8) => {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
};

export class World {
  constructor(scene) {
    this.scene = scene;
    this.seasonGroup = new THREE.Group();
    this.dynGroup = new THREE.Group(); // грядки, постройки, декор, clutter
    scene.add(this.seasonGroup, this.dynGroup);
    this.groundMat = mat(PALETTE.grass);
    this.leafMats = [];
    this.waterMat = mat(PALETTE.water, { roughness: 0.4 });
    this.pathMat = mat(PALETTE.path);
    this.buildStatic();
  }

  buildStatic() {
    const P = PALETTE;
    // Земля
    const ground = new THREE.Mesh(new THREE.BoxGeometry(46, 0.4, 46), this.groundMat);
    ground.position.y = -0.2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Река вдоль восточного края (x = 17..23)
    const river = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 46), this.waterMat);
    river.position.set(19.5, 0.02, 0);
    river.receiveShadow = true;
    this.scene.add(river);
    // Пляж
    const beach = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.36, 46), mat(P.sand));
    beach.position.set(15.9, -0.02, 0);
    beach.receiveShadow = true;
    this.scene.add(beach);

    // Причал
    const pier = new THREE.Group();
    const deck = box(1.6, 0.14, 3.4, P.wood);
    deck.position.set(0, 0.22, 0);
    pier.add(deck);
    for (const dz of [-1.4, 1.4]) {
      const p1 = box(0.14, 0.5, 0.14, P.woodDark); p1.position.set(-0.6, 0.05, dz);
      const p2 = p1.clone(); p2.position.x = 0.6;
      pier.add(p1, p2);
    }
    pier.position.set(17.6, 0, 4);
    this.scene.add(pier);

    // Дорога: от дома (0,0) на юг к деревне
    const road = new THREE.Mesh(new THREE.BoxGeometry(2, 0.05, 20), this.pathMat);
    road.position.set(0, 0.03, 14);
    road.receiveShadow = true;
    this.scene.add(road);
    const road2 = new THREE.Mesh(new THREE.BoxGeometry(12, 0.05, 2), this.pathMat);
    road2.position.set(5, 0.03, 19);
    road2.receiveShadow = true;
    this.scene.add(road2);

    // Дом фермы (северо-запад)
    const house = this.house(P);
    house.position.set(-6, 0, -6);
    this.scene.add(house);

    // Лавка Ашота (юго-восток деревни)
    const shop = this.stall(P);
    shop.position.set(8, 0, 19.5);
    this.scene.add(shop);

    // Доска заказов рядом
    const board = this.board(P);
    board.position.set(4.5, 0, 19.5);
    this.scene.add(board);

    // Забор по периметру фермы
    for (let x = -11; x <= 11; x += 2) {
      for (const z of [-11, 11]) {
        const f = box(0.12, 0.8, 0.12, P.wood); f.position.set(x, 0.4, z);
        this.scene.add(f);
      }
    }
    for (let z = -11; z <= 11; z += 2) {
      for (const x of [-11, 11]) {
        const f = box(0.12, 0.8, 0.12, P.wood); f.position.set(x, 0.4, z);
        this.scene.add(f);
      }
    }

    // Берёзы и деревья вокруг
    const treeSpots = [
      [-14, -2], [-14, 4], [-9, -14], [-3, -14], [3, -14], [9, -14], [14, -8],
      [-14, 10], [-10, 14], [14, 12], [14, -2], [-6, 14], [10, 8],
    ];
    for (const [x, z] of treeSpots) this.scene.add(this.tree(P, x + (Math.random() - 0.5), z + (Math.random() - 0.5)));
    for (const [x, z] of [[-12.5, 7], [12.5, 3], [-12.5, -9]]) this.scene.add(this.birch(P, x, z));

    // Кусты
    for (const [x, z] of [[-8, 2], [6, -8], [-4, 8], [8, -4], [-9, 9]]) {
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), mat(P.leaf));
      bush.position.set(x, 0.4, z);
      bush.castShadow = true;
      this.leafMats.push(bush.material);
      this.seasonGroup.add(bush);
    }
  }

  house(P) {
    const g = new THREE.Group();
    const base = box(4.4, 2.2, 3.6, P.wall); base.position.y = 1.1;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.6, 4), mat(P.roof));
    roof.position.y = 3; roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    const door = box(0.9, 1.5, 0.1, P.woodDark); door.position.set(0, 0.75, 1.83);
    const win1 = box(0.7, 0.7, 0.08, 0xbfe3f0); win1.position.set(-1.3, 1.3, 1.83);
    const win2 = win1.clone(); win2.position.x = 1.3;
    const chimney = box(0.5, 1, 0.5, P.stone); chimney.position.set(1.4, 3.1, -0.8);
    g.add(base, roof, door, win1, win2, chimney);
    return g;
  }

  stall(P) {
    const g = new THREE.Group();
    const counter = box(2.6, 0.9, 1, P.wood); counter.position.y = 0.45;
    const roof = box(3, 0.12, 1.6, P.roofAlt); roof.position.y = 2.1;
    for (const dx of [-1.3, 1.3]) {
      const pole = box(0.12, 2.1, 0.12, P.woodDark); pole.position.set(dx, 1.05, -0.6);
      g.add(pole);
    }
    const crate1 = box(0.5, 0.4, 0.5, P.woodDark); crate1.position.set(-0.7, 1.1, 0);
    const crate2 = box(0.4, 0.3, 0.4, P.woodDark); crate2.position.set(0.2, 1.05, 0.1);
    const awning = box(3.1, 0.06, 0.5, 0xe8506a); awning.position.set(0, 2.2, 0.5);
    g.add(counter, roof, crate1, crate2, awning);
    return g;
  }

  board(P) {
    const g = new THREE.Group();
    const post1 = box(0.12, 1.6, 0.12, P.woodDark); post1.position.set(-0.7, 0.8, 0);
    const post2 = post1.clone(); post2.position.x = 0.7;
    const panel = box(1.8, 1.1, 0.08, P.wood); panel.position.y = 1.3;
    const paper1 = box(0.4, 0.5, 0.02, 0xf5f0e0); paper1.position.set(-0.4, 1.35, 0.06); paper1.rotation.z = 0.06;
    const paper2 = paper1.clone(); paper2.position.x = 0.35; paper2.rotation.z = -0.08;
    g.add(post1, post2, panel, paper1, paper2);
    return g;
  }

  tree(P, x, z) {
    const g = new THREE.Group();
    const trunk = cyl(0.16, 0.24, 1.4, P.woodDark, 6); trunk.position.y = 0.7;
    const m1 = mat(P.leaf); this.leafMats.push(m1);
    const c1 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), m1); c1.position.y = 2; c1.castShadow = true;
    const m2 = mat(P.leaf); this.leafMats.push(m2);
    const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), m2); c2.position.set(0.5, 2.6, 0.2); c2.castShadow = true;
    g.add(trunk, c1, c2);
    g.position.set(x, 0, z);
    return g;
  }

  birch(P, x, z) {
    const g = new THREE.Group();
    const trunk = cyl(0.12, 0.16, 2.4, P.birchBark, 6); trunk.position.y = 1.2;
    const m = mat(P.leaf); this.leafMats.push(m);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), m);
    crown.position.y = 2.9; crown.castShadow = true;
    g.add(trunk, crown);
    g.position.set(x, 0, z);
    return g;
  }

  // --- Динамические объекты ---

  bedMesh(greenhouse) {
    const g = new THREE.Group();
    const soil = box(1.5, 0.22, 1.5, greenhouse ? 0x5a3a22 : PALETTE.soil);
    soil.position.y = 0.11;
    const rim1 = box(1.7, 0.16, 0.14, PALETTE.woodDark); rim1.position.set(0, 0.1, 0.78);
    const rim2 = rim1.clone(); rim2.position.z = -0.78;
    const rim3 = box(0.14, 0.16, 1.7, PALETTE.woodDark); rim3.position.set(0.78, 0.1, 0);
    const rim4 = rim3.clone(); rim4.position.x = -0.78;
    g.add(soil, rim1, rim2, rim3, rim4);
    if (greenhouse) {
      const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 0.9, 1.1, 6, 1, false, 0, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0.4, flatShading: true })
      );
      glass.position.y = 0.6; glass.rotation.z = Math.PI / 2; glass.rotation.y = Math.PI / 2;
      glass.castShadow = true;
      g.add(glass);
    }
    return g;
  }

  plantMesh(cropId, stage) {
    const g = new THREE.Group();
    if (stage >= 1) {
      const stem = cyl(0.03, 0.04, 0.25 * stage, 0x3e7a2e, 5);
      stem.position.y = 0.12 * stage;
      g.add(stem);
    }
    const colors = { radish: 0xe85a6a, carrot: 0xf09030, potato: 0x7ac048, wheat: 0xe8c048, sunflower: 0xf0c020, pumpkin: 0xf08030 };
    if (stage >= 2) {
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 * stage, 0), mat(colors[cropId] || 0x7ac048));
      head.position.y = 0.3 * stage;
      head.castShadow = true;
      g.add(head);
    }
    return g;
  }

  clutterMesh(kind) {
    if (kind === "stone") { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), mat(PALETTE.stone)); s.position.y = 0.3; s.castShadow = true; return s; }
    if (kind === "stump") { const s = cyl(0.3, 0.38, 0.5, PALETTE.woodDark, 7); s.position.y = 0.25; return s; }
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const blade = cone(0.05, 0.5 + Math.random() * 0.3, 0x9ab04a, 4);
      blade.position.set((Math.random() - 0.5) * 0.6, 0.3, (Math.random() - 0.5) * 0.6);
      blade.rotation.z = (Math.random() - 0.5) * 0.4;
      g.add(blade);
    }
    return g;
  }

  buildingMesh(id) {
    const P = PALETTE;
    const g = new THREE.Group();
    if (id === "coop") {
      const base = box(2, 1.2, 1.6, P.wallAlt); base.position.y = 0.6;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.9, 4), mat(P.roof)); roof.position.y = 1.65; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
      const hole = box(0.4, 0.4, 0.05, P.woodDark); hole.position.set(0, 0.5, 0.81);
      g.add(base, roof, hole);
    } else if (id === "cowshed" || id === "sheepfold") {
      const base = box(3.2, 1.8, 2.4, P.wall); base.position.y = 0.9;
      const roof = box(3.6, 0.2, 2.8, P.roof); roof.position.y = 1.95; roof.rotation.x = 0; roof.castShadow = true;
      const roof2 = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.1, 4), mat(P.roof)); roof2.position.y = 2.5; roof2.rotation.y = Math.PI / 4; roof2.scale.set(1.3, 1, 1); roof2.castShadow = true;
      const door = box(1.2, 1.2, 0.06, P.woodDark); door.position.set(0, 0.6, 1.21);
      g.add(base, roof2, door);
    } else if (id === "barn") {
      const base = box(3.4, 2, 2.6, P.wood); base.position.y = 1;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 4), mat(P.roofAlt)); roof.position.y = 2.6; roof.rotation.y = Math.PI / 4; roof.scale.set(1.25, 1, 1); roof.castShadow = true;
      const door = box(1.4, 1.4, 0.06, P.woodDark); door.position.set(0, 0.7, 1.31);
      g.add(base, roof, door);
    } else if (id === "well") {
      const ring = cyl(0.7, 0.75, 0.6, P.stone, 10); ring.position.y = 0.3;
      const post1 = box(0.1, 1.4, 0.1, P.woodDark); post1.position.set(-0.55, 1, 0);
      const post2 = post1.clone(); post2.position.x = 0.55;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.5, 4), mat(P.roof)); roof.position.y = 1.9; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
      const bar = cyl(0.04, 0.04, 1.1, P.wood, 6); bar.rotation.z = Math.PI / 2; bar.position.y = 1.5;
      g.add(ring, post1, post2, roof, bar);
    } else if (id === "mill") {
      const tower = cyl(0.9, 1.2, 2.6, P.wall, 8); tower.position.y = 1.3;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.9, 8), mat(P.roof)); roof.position.y = 3; roof.castShadow = true;
      const hub = cyl(0.08, 0.08, 0.3, P.woodDark, 6); hub.rotation.x = Math.PI / 2; hub.position.set(0, 2.2, 1.05);
      const blades = new THREE.Group(); blades.name = "blades";
      for (let i = 0; i < 4; i++) {
        const blade = box(0.24, 1.7, 0.05, P.sand);
        blade.position.y = 0.85;
        const arm = new THREE.Group();
        arm.add(blade);
        arm.rotation.z = i * Math.PI / 2;
        arm.position.set(0, 2.2, 1.12);
        blades.add(arm);
      }
      g.add(tower, roof, hub, blades);
    } else if (id === "greenhouse") {
      const base = box(3, 0.3, 2.2, P.wood); base.position.y = 0.15;
      const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0.45, flatShading: true });
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3, 3, 1, false, 0, Math.PI), glassMat);
      top.rotation.z = Math.PI / 2; top.rotation.y = Math.PI / 2; top.position.y = 0.9;
      top.castShadow = true;
      g.add(base, top);
    } else if (id === "fence") {
      for (const dx of [-0.5, 0.5]) { const p = box(0.1, 0.8, 0.1, P.wood); p.position.set(dx, 0.4, 0); g.add(p); }
      const rail = box(1.2, 0.1, 0.06, P.wood); rail.position.y = 0.6;
      g.add(rail);
    } else if (id === "flowerbed") {
      const bed = cyl(0.5, 0.6, 0.3, P.woodDark, 8); bed.position.y = 0.15;
      for (let i = 0; i < 5; i++) {
        const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), mat([0xe85a6a, 0xf0c020, 0xe890c0][i % 3]));
        const a = (i / 5) * Math.PI * 2;
        fl.position.set(Math.cos(a) * 0.3, 0.42, Math.sin(a) * 0.3);
        g.add(fl);
      }
      g.add(bed);
    } else if (id === "scarecrow") {
      const post = box(0.1, 1.4, 0.1, P.woodDark); post.position.y = 0.7;
      const arms = box(1, 0.08, 0.08, P.wood); arms.position.y = 1;
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), mat(0xe8c080)); head.position.y = 1.5; head.castShadow = true;
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.2, 6), mat(P.roofAlt)); hat.position.y = 1.68;
      g.add(post, arms, head, hat);
    } else if (id === "lantern") {
      const post = box(0.08, 1.6, 0.08, P.woodDark); post.position.y = 0.8;
      const lamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: 0xffe8a0, emissive: 0xe8a020, emissiveIntensity: 0.6, flatShading: true }));
      lamp.position.y = 1.7;
      g.add(post, lamp);
    } else if (id === "bench") {
      const seat = box(1.4, 0.1, 0.5, P.wood); seat.position.y = 0.45;
      const back = box(1.4, 0.5, 0.08, P.wood); back.position.set(0, 0.75, -0.22);
      for (const dx of [-0.55, 0.55]) { const leg = box(0.1, 0.45, 0.4, P.woodDark); leg.position.set(dx, 0.22, 0); g.add(leg); }
      g.add(seat, back);
    }
    return g;
  }

  scaffoldMesh() {
    const g = new THREE.Group();
    const P = PALETTE;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const pole = box(0.1, 2.2, 0.1, P.woodDark); pole.position.set(dx, 1.1, dz);
      g.add(pole);
    }
    const beam1 = box(2.2, 0.08, 0.08, P.wood); beam1.position.set(0, 1.8, -1);
    const beam2 = beam1.clone(); beam2.position.z = 1;
    g.add(beam1, beam2);
    return g;
  }

  penMesh(kind) {
    const g = new THREE.Group();
    const P = PALETTE;
    const w = kind === "coop" ? 3 : 4, d = kind === "coop" ? 2.6 : 3.4;
    for (let x = -w / 2; x <= w / 2; x += 1) {
      for (const z of [-d / 2, d / 2]) { const p = box(0.1, 0.7, 0.1, P.woodDark); p.position.set(x, 0.35, z); g.add(p); }
    }
    for (let z = -d / 2; z <= d / 2; z += 1) {
      for (const x of [-w / 2, w / 2]) { const p = box(0.1, 0.7, 0.1, P.woodDark); p.position.set(x, 0.35, z); g.add(p); }
    }
    const trough = box(0.8, 0.2, 0.3, P.wood); trough.position.set(0, 0.1, d / 2 - 0.4);
    g.add(trough);
    return g;
  }

  // Сезонная перекраска
  applySeason(season) {
    const P = PALETTE;
    const grass = [P.grass, 0x9cc452, P.grassDry, P.snow][season];
    this.groundMat.color.setHex(grass);
    const leaf = [P.leaf, 0x4ea03e, P.leafAutumn, 0xd8e0e4][season];
    for (const m of this.leafMats) m.color.setHex(leaf);
    this.waterMat.color.setHex(season === 3 ? 0x8ac4e0 : P.water);
  }
}
