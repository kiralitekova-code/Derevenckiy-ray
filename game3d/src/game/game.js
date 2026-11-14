// Главный модуль игры: сцена, ввод, механики, панели, рыбалка, сон, сохранение.
// createGame({ mount, tweaks }) -> { preload, start, state }

import * as THREE from "three";
import { World, PALETTE } from "./world.js";
import { loadAtlases, spriteEl } from "./atlas.js";
import { loadModel } from "./models.js";
import { buildDom, toast, toastQueue, openPanel, closePanel, svg, el, itemIcon, rowIco } from "./ui.js";
import {
  SEASONS, CROPS, ITEMS, FISH, ANIMALS, BUILDINGS, DECOR, WORKERS, NEIGHBORS,
  newState, seasonOf, clockOf, isNight,
} from "./state.js";

const SAVE_KEY = "dray-nasledie-v1";

export function createGame({ mount, tweaks }) {
  const values = (tweaks && tweaks.values) || {};
  const tv = (name, dflt) => (values[name] && values[name].value != null ? values[name].value : dflt);
  const DAY_LENGTH = tv("dayLength", 240);
  const SEASON_DAYS = tv("seasonDays", 7);
  const GROWTH = tv("growthSpeed", 1);
  const BUILD_SPD = tv("buildSpeed", 1);
  const WALK = tv("walkSpeed", 4.5);
  const CAM_ZOOM_TWEAK = tv("cameraZoom", 1);
  const FISH_ZONE = tv("fishZone", 1);
  const USE_SHADOWS = tv("shadows", true);

  const state = newState();
  const dom = buildDom(mount);

  let renderer = null;
  let scene = null;
  let camera = null;
  let world = null;
  let sun = null;
  let hemi = null;
  let ambient = null;
  const clock = new THREE.Clock();

  let started = false;
  let inputBound = false;
  let actors = {};
  const animalMeshes = new Map();
  const trackedMeshes = [];
  let worldRayMeshes = [];
  let camZoom = 1;
  let target = null;
  let buildMode = null;
  let ghost = null;
  let fishing = null;
  let seedSel = "radish";
  let rainFlash = 0;
  let saveTimer = 0;
  let hudTimer = 0;
  const keys = {};
  const joy = { active: false, id: null, dx: 0, dy: 0 };
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // ---------- Утилиты ----------

  const inv = (id) => state.inventory[id] || 0;
  const give = (id, n) => { state.inventory[id] = inv(id) + n; };
  const take = (id, n) => { state.inventory[id] = Math.max(0, inv(id) - n); };
  const hasDone = (id) => state.buildings.some((b) => b.id === id && b.done);
  const waterMax = () => 12 + (hasDone("well") ? 4 : 0);
  const workersCount = () => state.workers.length;
  const buildPrice = (price) => Math.round((state.gifts && state.gifts.senya ? price * 0.9 : price) / 5) * 5;
  const seedPrice = (price) => (state.gifts && state.gifts.ashot ? Math.round(price * 0.9) : price);

  function recapAdd(ico, text) {
    state.recap.push({ ico, text });
    if (state.recap.length > 30) state.recap.shift();
  }

  // ---------- Сцена ----------

  function initScene() {
    renderer = new THREE.WebGLRenderer({ canvas: dom.canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !!USE_SHADOWS;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fd8f0);
    scene.fog = new THREE.Fog(0x9fd8f0, 34, 78);

    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(0, 10, 9);

    hemi = new THREE.HemisphereLight(0xdfeaf5, 0x8a7a55, 0.85);
    scene.add(hemi);
    ambient = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(ambient);
    sun = new THREE.DirectionalLight(0xfff2d8, 1.1);
    if (USE_SHADOWS) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -26;
      sun.shadow.camera.right = 26;
      sun.shadow.camera.top = 26;
      sun.shadow.camera.bottom = -26;
      sun.shadow.camera.far = 90;
    }
    scene.add(sun);

    world = new World(scene);

    const onResize = () => {
      const w = dom.surface.clientWidth || window.innerWidth;
      const h = dom.surface.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);
    onResize();
  }

  // ---------- Актёры ----------

  function collectRig(obj) {
    const rig = {};
    obj.traverse((o) => { if (o.name && !rig[o.name]) rig[o.name] = o; });
    return rig;
  }

  async function spawnHero() {
    const key = state.hero === "masha" ? "hero_masha" : "hero_max";
    const obj = await loadModel(key);
    obj.position.set(0, 0, 8);
    scene.add(obj);
    actors.hero = { obj, rig: collectRig(obj), anchor: new THREE.Vector3(0, 0, 8), target: null, wait: 0 };
  }

  const NPC_SPOTS = {
    nyura: [-2, 18.4], ashot: [8.6, 18.4], senya: [2.2, 18.1],
    vika: [-5.2, 18.6], fil: [12, 17.6], petrovich: [-8, 17.8], gosha: [5, 18.8],
  };

  async function spawnNPCs() {
    for (const entry of Object.entries(NPC_SPOTS)) {
      const id = entry[0];
      const spot = entry[1];
      const obj = await loadModel(id);
      obj.position.set(spot[0], 0, spot[1]);
      scene.add(obj);
      actors[id] = { obj, rig: collectRig(obj), anchor: new THREE.Vector3(spot[0], 0, spot[1]), target: null, wait: Math.random() * 3 };
    }
  }

  function walkAnim(rig, t, speed = 1) {
    const s = Math.sin(t * 9 * speed);
    if (rig.leg_left) rig.leg_left.rotation.x = s * 0.55;
    if (rig.leg_right) rig.leg_right.rotation.x = -s * 0.55;
    if (rig.arm_left) rig.arm_left.rotation.x = -s * 0.4;
    if (rig.arm_right) rig.arm_right.rotation.x = s * 0.4;
  }

  function idleAnim(rig, t) {
    if (rig.leg_left) rig.leg_left.rotation.x = 0;
    if (rig.leg_right) rig.leg_right.rotation.x = 0;
    if (rig.arm_left) rig.arm_left.rotation.x = Math.sin(t * 1.8) * 0.06;
    if (rig.arm_right) rig.arm_right.rotation.x = -Math.sin(t * 1.8) * 0.06;
    if (rig.torso) rig.torso.scale.y = 1 + Math.sin(t * 2.2) * 0.02;
    if (rig.head) rig.head.rotation.x = Math.sin(t * 0.9) * 0.05;
  }

  // ---------- Динамические объекты мира ----------

  function clearDyn() {
    world.dynGroup.clear();
    trackedMeshes.length = 0;
    worldRayMeshes = [];
    animalMeshes.clear();
  }

  function addLinked(mesh, link) {
    mesh.userData.link = link;
    world.dynGroup.add(mesh);
    trackedMeshes.push(mesh);
    mesh.traverse((o) => { if (o.isMesh) worldRayMeshes.push(o); });
  }

  function ensureGreenhouseBeds() {
    for (const b of state.buildings) {
      if (b.id !== "greenhouse" || !b.done) continue;
      for (const dx of [-1.8, 0, 1.8]) {
        const x = b.x + dx;
        const z = b.z + 2.4;
        if (!state.beds.some((bed) => bed.greenhouse && Math.abs(bed.x - x) < 0.5 && Math.abs(bed.z - z) < 0.5)) {
          state.beds.push({ x, z, crop: null, stage: 0, watered: false, done: false, greenhouse: true });
        }
      }
    }
  }

  function rebuildWorldObjects() {
    clearDyn();
    ensureGreenhouseBeds();

    for (const bed of state.beds) {
      const m = world.bedMesh(bed.greenhouse);
      m.position.set(bed.x, 0, bed.z);
      if (bed.crop && bed.stage > 0) {
        const crop = CROPS[bed.crop];
        const vis = Math.min(3, Math.max(1, Math.ceil((bed.stage / crop.hours) * 3)));
        m.add(world.plantMesh(bed.crop, vis));
      }
      addLinked(m, { kind: "bed", ref: bed });
    }

    for (const c of state.clutter) {
      const m = world.clutterMesh(c.kind);
      m.position.set(c.x, 0, c.z);
      addLinked(m, { kind: "clutter", ref: c });
    }

    for (const b of state.buildings) {
      const m = b.done ? world.buildingMesh(b.id) : world.scaffoldMesh();
      m.position.set(b.x, 0, b.z);
      addLinked(m, { kind: "building", ref: b });
      if (b.done && (b.id === "coop" || b.id === "cowshed" || b.id === "sheepfold")) {
        const pen = world.penMesh(b.id);
        pen.position.set(b.x, 0, b.z + 2.6);
        world.dynGroup.add(pen);
      }
    }

    for (const d of state.decor) {
      const m = d.id === "birch" ? world.birch(PALETTE, 0, 0) : world.buildingMesh(d.id);
      m.position.set(d.x, 0, d.z);
      addLinked(m, { kind: "decor", ref: d });
    }

    syncAnimalMeshes();
  }

  function syncAnimalMeshes() {
    state.animals.forEach((a) => {
      if (animalMeshes.has(a)) return;
      loadModel(a.kind).then((mesh) => {
        if (!state.animals.includes(a)) return;
        mesh.position.set(a.x, 0, a.z);
        world.dynGroup.add(mesh);
        animalMeshes.set(a, { obj: mesh, rig: collectRig(mesh), t: Math.random() * 10 });
      });
    });
  }

  // ---------- Ввод ----------

  function bindInput() {
    if (inputBound) return;
    inputBound = true;

    const joyZone = dom.joyZone;
    joyZone.addEventListener("pointerdown", (e) => {
      joy.active = true;
      joy.id = e.pointerId;
      try { joyZone.setPointerCapture(e.pointerId); } catch { /* noop */ }
      joyMove(e);
    });
    joyZone.addEventListener("pointermove", joyMove);
    const joyEnd = () => { joy.active = false; joy.dx = 0; joy.dy = 0; dom.knob.style.transform = ""; };
    joyZone.addEventListener("pointerup", joyEnd);
    joyZone.addEventListener("pointercancel", joyEnd);

    function joyMove(e) {
      if (!joy.active || e.pointerId !== joy.id) return;
      const r = dom.joy.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = (e.clientX - cx) / (r.width / 2);
      let dy = (e.clientY - cy) / (r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      joy.dx = dx;
      joy.dy = dy;
      dom.knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
    }

    window.addEventListener("keydown", (e) => {
      keys[e.code] = true;
      if (e.code === "Space" || e.code === "KeyE") { e.preventDefault(); doAction(); }
      if (e.code === "KeyI") openBackpack();
      if (e.code === "KeyB") openBuild();
    });
    window.addEventListener("keyup", (e) => { keys[e.code] = false; });

    dom.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      camZoom = Math.min(1.5, Math.max(0.6, camZoom + Math.sign(e.deltaY) * 0.08));
    }, { passive: false });

    let tapPos = null;
    let tapTime = 0;
    dom.canvas.addEventListener("pointerdown", (e) => { tapPos = [e.clientX, e.clientY]; tapTime = clock.elapsedTime; });
    dom.canvas.addEventListener("pointerup", (e) => {
      if (!tapPos) return;
      const moved = Math.hypot(e.clientX - tapPos[0], e.clientY - tapPos[1]);
      const dtime = clock.elapsedTime - tapTime;
      tapPos = null;
      if (moved > 8 || dtime > 350) return;
      if (buildMode) { tryPlaceAt(e.clientX, e.clientY); return; }
      pickTargetAt(e.clientX, e.clientY);
    });

    dom.actionBtn.addEventListener("click", doAction);
    dom.seedChip.addEventListener("click", openBackpack);
    dom.bagBtn.addEventListener("click", openBackpack);
    dom.diaryBtn.addEventListener("click", openDiary);
    dom.buildBtn.addEventListener("click", openBuild);
    dom.rainBtn.addEventListener("click", watchAdForRain);

    document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
  }

  function pickTargetAt(cx, cy) {
    const r = dom.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(worldRayMeshes, false);
    if (!hits.length) return;
    let o = hits[0].object;
    while (o && !o.userData.link) o = o.parent;
    if (o && o.userData.link) {
      target = computeTargetFor(o.userData.link);
      refreshActionBtn();
    }
  }

  // ---------- Контекстное действие ----------

  function computeTargetFor(link) {
    const kind = link.kind;
    const ref = link.ref;
    if (kind === "bed") {
      if (!ref.crop) return { kind, ref, label: `Посадить: ${CROPS[seedSel].name}`, ico: "seed" };
      if (ref.done) return { kind, ref, label: "Собрать урожай", ico: "hand" };
      if (!ref.watered) return { kind, ref, label: "Полить", ico: "can" };
      return { kind, ref, label: `${CROPS[ref.crop].name}: растёт`, ico: "sun", off: true };
    }
    if (kind === "clutter") return { kind, ref, label: "Расчистить", ico: "hammer" };
    if (kind === "building") {
      if (!ref.done) return { kind, ref, label: `Стройка: ${Math.round((1 - ref.hoursLeft / BUILDINGS[ref.id].hours) * 100)}%`, ico: "hammer", off: true };
      if (ref.id === "well") return { kind, ref, label: "Набрать воды", ico: "drop" };
      if (ref.id === "mill") return { kind, ref, label: "Мельница", ico: "sun" };
      return { kind, ref, label: BUILDINGS[ref.id].name, ico: "star", off: true };
    }
    if (kind === "decor") return { kind, ref, label: DECOR[ref.id].name, ico: "star", off: true };
    return null;
  }

  function nearestOf(list, pos, radius) {
    let best = null;
    let bestD = radius;
    for (const link of list) {
      const o = link && link.ref;
      if (!o || o.x == null) continue;
      const d = Math.hypot(o.x - pos.x, o.z - pos.z);
      if (d < bestD) { bestD = d; best = link; }
    }
    return best;
  }

  function nearestAnimal(pos) {
    let best = null;
    let bestD = 2.2;
    for (const a of state.animals) {
      const d = Math.hypot(a.x - pos.x, a.z - pos.z);
      if (d < bestD) { bestD = d; best = a; }
    }
    return best;
  }

  function animalTarget(a) {
    const def = ANIMALS[a.kind];
    if (a.ready) return { kind: "animal", ref: a, label: `Собрать: ${ITEMS[def.product].name}`, ico: "hand" };
    if (!a.fed) return { kind: "animal", ref: a, label: `Накормить: ${def.name}`, ico: "seed" };
    return { kind: "animal", ref: a, label: `${def.name}: довольна`, ico: "heart", off: true };
  }

  function computeTarget() {
    const hero = actors.hero;
    if (!hero) return null;
    const p = hero.obj.position;

    const link = nearestOf(trackedMeshes.map((m) => m.userData.link).filter(Boolean), p, 2.1);
    if (link) return computeTargetFor(link);

    const animal = nearestAnimal(p);
    if (animal) return animalTarget(animal);

    for (const entry of Object.entries(actors)) {
      const id = entry[0];
      const npc = entry[1];
      if (id === "hero" || !npc) continue;
      if (npc.obj.position.distanceTo(p) < 2.2) {
        return { kind: "npc", ref: id, label: `Поговорить: ${NEIGHBORS[id] ? NEIGHBORS[id].name : id}`, ico: "heart" };
      }
    }

    if (p.z > 16 && Math.abs(p.x - 8.6) < 2.6) return { kind: "shop", label: "Лавка Ашота", ico: "cart" };
    if (p.z > 16 && Math.abs(p.x - 4.5) < 2.4) return { kind: "board", label: "Доска заказов", ico: "board" };
    if (Math.abs(p.x + 6) < 2.8 && Math.abs(p.z + 6) < 2.8) return { kind: "house", label: "Дом: спать", ico: "bed" };
    if (p.x > 15.2) return { kind: "river", label: "Рыбалка / набрать воду", ico: "fish" };
    return null;
  }

  function refreshActionBtn() {
    target = computeTarget();
    const btn = dom.actionBtn;
    btn.classList.toggle("off", !target || !!target.off);
    dom.actionLabel.textContent = target ? target.label : "Подойди ближе";
    dom.actionIco.replaceChildren(svg(target ? target.ico : "hand", "ico-svg"));
  }

  function doAction() {
    if (fishing) { fishingAction(); return; }
    if (buildMode) { cancelBuild(); return; }
    if (!target || target.off) return;
    const t = target;

    if (t.kind === "bed") {
      const b = t.ref;
      if (!b.crop) {
        const crop = CROPS[seedSel];
        if ((state.seeds[seedSel] || 0) <= 0) { toast(dom, `Нет семян: ${crop.name}`, "warn"); return; }
        if (!crop.seasons.includes(seasonOf(state)) && !b.greenhouse) {
          toast(dom, `${crop.name} не растёт в ${SEASONS[seasonOf(state)].toLowerCase()}`, "warn");
          return;
        }
        state.seeds[seedSel] -= 1;
        b.crop = seedSel;
        b.stage = 0;
        b.watered = false;
        b.done = false;
        toast(dom, `Посажено: ${crop.name}`, "good");
      } else if (b.done) {
        const crop = CROPS[b.crop];
        const bonus = hasDone("barn") ? 1 : 0;
        give(b.crop, crop.yield + bonus);
        recapAdd(b.crop, `${crop.name}: +${crop.yield + bonus}`);
        toast(dom, `Собрано: ${crop.name} ×${crop.yield + bonus}`, "good");
        b.crop = null;
        b.stage = 0;
        b.watered = false;
        b.done = false;
      } else if (!b.watered) {
        if (state.water <= 0) { toast(dom, "Вода кончилась! Набери у реки или колодца", "warn"); return; }
        state.water -= 1;
        b.watered = true;
        toast(dom, "Полито", "good");
      }
      rebuildWorldObjects();
    } else if (t.kind === "clutter") {
      const c = t.ref;
      state.clutter = state.clutter.filter((x) => x !== c);
      const reward = c.kind === "weed" ? 1 : 3;
      if (c.kind === "weed") give("hay", 1);
      state.coins += reward;
      toast(dom, `Расчищено: +${reward} монет`, "good");
      rebuildWorldObjects();
    } else if (t.kind === "building") {
      const b = t.ref;
      if (b.done && b.id === "well") {
        state.water = waterMax();
        toast(dom, "Вода пополнена", "good");
      } else if (b.done && b.id === "mill") {
        openMill();
      }
    } else if (t.kind === "animal") {
      const a = t.ref;
      if (a.ready) {
        const def = ANIMALS[a.kind];
        give(def.product, 1);
        recapAdd(def.product, `${ITEMS[def.product].name}: +1`);
        a.ready = false;
        a.prog = 0;
        toast(dom, `${ITEMS[def.product].name}: +1`, "good");
      } else if (!a.fed) {
        if (inv("hay") <= 0) { toast(dom, "Нужно сено! Расчисти бурьян", "warn"); return; }
        take("hay", 1);
        a.fed = true;
        toast(dom, `${ANIMALS[a.kind].name} накормлена`, "good");
      }
    } else if (t.kind === "npc") {
      talk(t.ref);
    } else if (t.kind === "shop") {
      openShop();
    } else if (t.kind === "board") {
      openOrders();
    } else if (t.kind === "house") {
      openSleep();
    } else if (t.kind === "river") {
      openRiver();
    }
    refreshHud();
    saveSoon();
  }

  // ---------- HUD ----------

  function refreshHud() {
    dom.coinSpan.textContent = String(state.coins);
    dom.waterSpan.textContent = `${state.water}/${waterMax()}`;
    dom.clockDay.textContent = `${SEASONS[seasonOf(state)]} · День ${((state.day - 1) % SEASON_DAYS) + 1} ·`;
    dom.clockTime.textContent = clockOf(state);
    const canRain = state.buildings.some((b) => !b.done) || state.beds.some((b) => b.crop && !b.watered && !b.done);
    dom.rainBtn.style.display = canRain ? "" : "none";
    dom.seedChip.replaceChildren();
    dom.seedChip.appendChild(itemIcon(seedSel, 22));
    const cnt = el("span", "", dom.seedChip);
    cnt.textContent = `${CROPS[seedSel].name} ×${state.seeds[seedSel] || 0}`;
    const hasLoot = Object.values(state.inventory).some((n) => n > 0);
    dom.bagDot.classList.toggle("hidden", !hasLoot);
  }

  // ---------- Пузыри над объектами ----------

  const v3 = new THREE.Vector3();

  function projectToScreen(x, y, z) {
    v3.set(x, y, z).project(camera);
    const w = dom.surface.clientWidth;
    const h = dom.surface.clientHeight;
    return [(v3.x * 0.5 + 0.5) * w, (-v3.y * 0.5 + 0.5) * h];
  }

  function updateBubbles() {
    dom.anchors.replaceChildren();
    if (!started) return;
    const addBubble = (x, y, z, cls, content) => {
      const pos = projectToScreen(x, y, z);
      const sx = pos[0];
      const sy = pos[1];
      if (sx < -40 || sy < -40 || sx > dom.surface.clientWidth + 40 || sy > dom.surface.clientHeight + 40) return;
      const b = el("div", "bubble " + cls, dom.anchors);
      b.style.left = sx + "px";
      b.style.top = sy + "px";
      if (content) b.appendChild(content);
    };
    for (const b of state.beds) {
      if (b.crop && b.done) addBubble(b.x, 1.1, b.z, "ready", itemIcon(b.crop, 26));
      else if (b.crop && !b.watered) addBubble(b.x, 1.0, b.z, "hungry", svg("drop", "bubble-ico"));
    }
    for (const a of state.animals) {
      if (a.ready) addBubble(a.x, 1.4, a.z, "ready", itemIcon(ANIMALS[a.kind].product, 26));
      else if (!a.fed) addBubble(a.x, 1.4, a.z, "hungry", itemIcon("hay", 26));
    }
    for (const b of state.buildings) {
      if (b.done) continue;
      const pct = Math.round((1 - b.hoursLeft / BUILDINGS[b.id].hours) * 100);
      const bub = el("div", "bubble progress-bub");
      bub.textContent = pct + "%";
      const pos = projectToScreen(b.x, 2.6, b.z);
      bub.style.left = pos[0] + "px";
      bub.style.top = pos[1] + "px";
      dom.anchors.appendChild(bub);
    }
  }

  // ---------- Портреты ----------

  function portraitEl(who, size) {
    return spriteEl("portraits", who, size);
  }

  // ---------- Панели ----------

  function openShop() {
    openPanel(dom, "panel-shop", (body, panel, h2) => {
      h2.textContent = "Лавка Ашота";
      const tabs = el("div", "tabs", body);
      const list = el("div", "", body);
      let tab = "buy";
      const render = () => {
        list.replaceChildren();
        const tabIds = ["buy", "sell"];
        [...tabs.children].forEach((t, i) => t.classList.toggle("on", tabIds[i] === tab));
        if (tab === "buy") {
          for (const entry of Object.entries(CROPS)) {
            const id = entry[0];
            const crop = entry[1];
            const row = el("div", "row", list);
            rowIco(row, id, 40);
            const main = el("div", "row-main", row);
            el("div", "", main).textContent = `Семена: ${crop.name}`;
            el("div", "sub", main).textContent = `Сезон: ${crop.seasons.map((s) => SEASONS[s]).join(", ")} · рост ${crop.hours} ч`;
            const btn = el("button", "buy-btn", row);
            btn.textContent = `${seedPrice(crop.seed)} 🪙`;
            btn.addEventListener("click", () => {
              const price = seedPrice(crop.seed);
              if (state.coins < price) { toast(dom, "Не хватает монет", "warn"); return; }
              state.coins -= price;
              state.seeds[id] = (state.seeds[id] || 0) + 1;
              toast(dom, `Куплены семена: ${crop.name}`, "good");
              refreshHud();
              saveSoon();
            });
          }
        } else {
          let any = false;
          for (const entry of Object.entries(state.inventory)) {
            const id = entry[0];
            const n = entry[1];
            if (!n || !ITEMS[id]) continue;
            any = true;
            const item = ITEMS[id];
            const row = el("div", "row", list);
            rowIco(row, id, 40);
            const main = el("div", "row-main", row);
            el("div", "", main).textContent = `${item.name} ×${n}`;
            const btn = el("button", "buy-btn", row);
            btn.textContent = `Продать ${item.sell * n} 🪙`;
            btn.addEventListener("click", () => {
              state.coins += item.sell * n;
              recapAdd("coin", `Продажа (${item.name}): +${item.sell * n}`);
              take(id, n);
              toast(dom, `Продано: ${item.name} ×${n} → +${item.sell * n} 🪙`, "good");
              render();
              refreshHud();
              saveSoon();
            });
          }
          if (!any) el("div", "empty", list).textContent = "Рюкзак пуст. Собери урожай или порыбачь!";
        }
      };
      for (const pair of [["buy", "Покупка"], ["sell", "Продажа"]]) {
        const t = el("button", "tab", tabs);
        t.textContent = pair[1];
        t.addEventListener("click", () => { tab = pair[0]; render(); });
      }
      render();
    });
  }

  function openMill() {
    openPanel(dom, "panel-mill", (body, panel, h2) => {
      h2.textContent = "Мельница";
      const mk = (need, out, outLabel) => {
        const row = el("div", "row", body);
        rowIco(row, out, 40);
        const main = el("div", "row-main", row);
        el("div", "", main).textContent = outLabel;
        el("div", "sub", main).textContent = need.map((p) => `${ITEMS[p[0]].name} ×${p[1]}`).join(" + ");
        const btn = el("button", "buy-btn", row);
        btn.textContent = "Смолоть";
        btn.addEventListener("click", () => {
          for (const p of need) {
            if (inv(p[0]) < p[1]) { toast(dom, `Нужно: ${ITEMS[p[0]].name} ×${p[1]}`, "warn"); return; }
          }
          for (const p of need) take(p[0], p[1]);
          give(out, 1);
          recapAdd(out, `${outLabel}: +1`);
          toast(dom, `Готово: ${outLabel}`, "good");
          refreshHud();
          saveSoon();
        });
      };
      mk([["wheat", 2]], "flour", "Мука (из 2 пшеницы)");
      mk([["flour", 1], ["egg", 1]], "pie", "Пирожки (мука + яйцо)");
    });
  }

  const DATIVE = { nyura: "Бабе Нюре", ashot: "Ашоту", senya: "Сене", vika: "Вике", fil: "Филу" };
  const FRIEND_BONUS = {
    nyura: "Семена в подарок",
    ashot: "Скидка на семена 10%",
    senya: "Стройка дешевле на 10%",
    vika: "Животные быстрее",
    fil: "Улучшение удочки",
  };

  function heartsEl(n) {
    const wrap = el("span", "hearts pip-row");
    for (let i = 0; i < 5; i++) {
      const pip = el("span", "pip" + (i < n ? " on" : ""));
      pip.appendChild(svg("heart", "pip-ico"));
      wrap.appendChild(pip);
    }
    return wrap;
  }

  function openOrders() {
    openPanel(dom, "panel-orders", (body, panel, h2) => {
      h2.textContent = "Заказы соседей";
      if (!state.orders.length) makeOrders();
      const cap = el("div", "cap", body);
      cap.textContent = "Друзья";
      for (const id of Object.keys(NEIGHBORS)) {
        const nb = NEIGHBORS[id];
        const fr = el("div", "friend", body);
        const fico = el("span", "friend-ico", fr);
        fico.appendChild(portraitEl(id, 40));
        const fmain = el("div", "row-main", fr);
        el("b", "", fmain).textContent = nb.name;
        el("small", "", fmain).textContent = "3 ♥: " + FRIEND_BONUS[id].toLowerCase();
        fr.appendChild(heartsEl(state.friendship[id] || 0));
      }
      for (const o of [...state.orders]) {
        const nb = NEIGHBORS[o.who];
        const row = el("div", "order", body);
        const port = el("span", "order-portrait", row);
        port.appendChild(portraitEl(o.who, 44));
        const main = el("div", "order-main", row);
        const top = el("div", "order-top", main);
        el("b", "", top).textContent = nb.name;
        top.appendChild(heartsEl(state.friendship[o.who] || 0));
        el("span", "price", top).textContent = `+${o.reward} 🪙`;
        const needs = el("div", "needs", main);
        let can = true;
        for (const entry of Object.entries(o.needs)) {
          const id = entry[0];
          const n = entry[1];
          const ok = inv(id) >= n;
          if (!ok) can = false;
          const need = el("span", "need" + (ok ? " done" : ""), needs);
          need.appendChild(itemIcon(id, 20));
          need.append(`${inv(id)}/${n}`);
        }
        const btn = el("button", "buy-btn wide" + (can ? "" : " off"), row);
        btn.textContent = `Отнести ${DATIVE[o.who] || nb.name}`;
        btn.addEventListener("click", () => {
          for (const entry of Object.entries(o.needs)) {
            if (inv(entry[0]) < entry[1]) { toast(dom, "Не хватает товаров", "warn"); return; }
          }
          for (const entry of Object.entries(o.needs)) take(entry[0], entry[1]);
          state.coins += o.reward;
          recapAdd("coin", `Заказ (${nb.name}): +${o.reward}`);
          state.friendship[o.who] = Math.min(5, (state.friendship[o.who] || 0) + 1);
          checkFriendGift(o.who);
          state.orders = state.orders.filter((x) => x !== o);
          toast(dom, `${nb.name} благодарит! +${o.reward} 🪙`, "gift");
          closePanel(dom);
          refreshHud();
          saveSoon();
        });
      }
      if (!state.orders.length) el("div", "empty", body).textContent = "Новые заказы будут утром!";
    });
  }

  function checkFriendGift(who) {
    state.gifts = state.gifts || {};
    if (state.friendship[who] < 3 || state.gifts[who]) return;
    state.gifts[who] = true;
    const gifts = {
      nyura: () => {
        state.seeds.carrot = (state.seeds.carrot || 0) + 3;
        state.seeds.potato = (state.seeds.potato || 0) + 2;
        return "Нюра подарила семена: морковь ×3, картофель ×2";
      },
      ashot: () => "Ашот: скидка 10% на семена!",
      senya: () => "Сеня: стройка дешевле на 10%!",
      vika: () => "Вика: животные дают продукцию быстрее!",
      fil: () => {
        state.rodLevel = Math.min(3, state.rodLevel + 1);
        return `Фил улучшил удочку (ур. ${state.rodLevel})!`;
      },
    };
    if (gifts[who]) toast(dom, "🎁 " + gifts[who](), "gift", 4200);
  }

  function openBackpack() {
    openPanel(dom, "panel-bag", (body, panel, h2) => {
      h2.textContent = "Рюкзак";
      const grid = el("div", "grid", body);
      let any = false;
      for (const entry of Object.entries(state.seeds)) {
        const id = entry[0];
        const n = entry[1];
        if (!n || !CROPS[id]) continue;
        any = true;
        const cell = el("button", "cell" + (id === seedSel ? " sel" : ""), grid);
        cell.appendChild(itemIcon(id, 40));
        el("div", "cell-name", cell).textContent = CROPS[id].name;
        el("div", "cell-count", cell).textContent = "×" + n;
        cell.addEventListener("click", () => {
          seedSel = id;
          toast(dom, `Выбрано: ${CROPS[id].name}`, "good");
          closePanel(dom);
          refreshHud();
        });
      }
      for (const entry of Object.entries(state.inventory)) {
        const id = entry[0];
        const n = entry[1];
        if (!n || !ITEMS[id]) continue;
        any = true;
        const cell = el("div", "cell", grid);
        cell.appendChild(itemIcon(id, 40));
        el("div", "cell-name", cell).textContent = ITEMS[id].name;
        el("div", "cell-count", cell).textContent = "×" + n;
      }
      if (!any) el("div", "empty", body).textContent = "Пусто. Посади семена на грядке!";
      el("div", "hint", body).textContent = "Выбери семена — они будут сажаться кнопкой действия.";
    });
  }

  function openDiary() {
    openPanel(dom, "panel-diary", (body, panel, h2) => {
      h2.textContent = "Дневник фермера";
      const st = el("div", "note", body);
      st.textContent = `${SEASONS[seasonOf(state)]}, день ${((state.day - 1) % SEASON_DAYS) + 1} · Удочка: ур. ${state.rodLevel} · Рабочих: ${workersCount()}`;
      const fishTitle = el("div", "sub", body);
      fishTitle.textContent = "Рыбалка:";
      const grid = el("div", "grid", body);
      for (const f of FISH) {
        const n = state.fishCaught[f.id] || 0;
        const cell = el("div", "cell" + (n ? "" : " unknown"), grid);
        cell.appendChild(itemIcon(f.id, 36));
        el("div", "cell-name", cell).textContent = ITEMS[f.id].name;
        el("div", "cell-count", cell).textContent = n ? "×" + n : "?";
      }
      const frTitle = el("div", "sub", body);
      frTitle.textContent = "Друзья:";
      for (const entry of Object.entries(state.friendship)) {
        const who = entry[0];
        const hearts = entry[1];
        const row = el("div", "friend", body);
        row.appendChild(portraitEl(who, 36));
        const name = el("span", "", row);
        name.textContent = NEIGHBORS[who].name;
        const hp = el("span", "hearts", row);
        for (let i = 0; i < 5; i++) {
          const pip = el("span", "pip" + (i < hearts ? " on" : ""), hp);
          pip.appendChild(svg("heart", "pip-ico"));
        }
      }
    });
  }

  function openBuild() {
    openPanel(dom, "panel-build", (body, panel, h2) => {
      h2.textContent = "Стройка";
      const tabs = el("div", "tabs", body);
      const list = el("div", "", body);
      let tab = "build";
      const render = () => {
        list.replaceChildren();
        const tabIds = ["build", "decor", "animals"];
        [...tabs.children].forEach((t, i) => t.classList.toggle("on", tabIds[i] === tab));
        if (tab === "build") {
          for (const entry of Object.entries(BUILDINGS)) {
            const id = entry[0];
            const b = entry[1];
            const row = el("div", "row", list);
            rowIco(row, id, 40);
            const main = el("div", "row-main", row);
            el("div", "", main).textContent = b.name;
            el("div", "sub", main).textContent = `${b.desc} · ${b.hours}ч · рабочих: ${workersCount()}`;
            const btn = el("button", "buy-btn", row);
            btn.textContent = `${buildPrice(b.price)} 🪙`;
            btn.addEventListener("click", () => startPlacement("buildings", id));
          }
          const wrow = el("div", "row", list);
          const wholder = el("span", "row-ico", wrow);
          wholder.style.display = "grid";
          wholder.style.placeItems = "center";
          wholder.appendChild(svg("hammer", "ico-svg"));
          const wmain = el("div", "row-main", wrow);
          el("div", "", wmain).textContent = "Рабочие";
          el("div", "sub", wmain).textContent = "Стройки идут быстрее с рабочими";
          for (const entry of Object.entries(WORKERS)) {
            const id = entry[0];
            const w = entry[1];
            if (state.workers.includes(id)) continue;
            const btn = el("button", "buy-btn", wrow);
            btn.textContent = w.price ? `${w.price} 🪙` : "Бесплатно";
            btn.addEventListener("click", () => {
              if (state.coins < w.price) { toast(dom, "Не хватает монет", "warn"); return; }
              state.coins -= w.price;
              state.workers.push(id);
              toast(dom, `${w.name} присоединился к работе!`, "good");
              render();
              refreshHud();
              saveSoon();
            });
          }
        } else if (tab === "decor") {
          for (const entry of Object.entries(DECOR)) {
            const id = entry[0];
            const d = entry[1];
            const row = el("div", "row", list);
            rowIco(row, id, 40);
            const main = el("div", "row-main", row);
            el("div", "", main).textContent = d.name;
            const btn = el("button", "buy-btn", row);
            btn.textContent = `${d.price} 🪙`;
            btn.addEventListener("click", () => startPlacement("decor", id));
          }
        } else {
          for (const entry of Object.entries(ANIMALS)) {
            const id = entry[0];
            const a = entry[1];
            const row = el("div", "row", list);
            rowIco(row, id, 40);
            const main = el("div", "row-main", row);
            el("div", "", main).textContent = a.name;
            el("div", "sub", main).textContent = `Нужна постройка: ${BUILDINGS[a.build].name} · даёт ${ITEMS[a.product].name.toLowerCase()}`;
            const btn = el("button", "buy-btn" + (hasDone(a.build) ? "" : " off"), row);
            btn.textContent = `${a.price} 🪙`;
            btn.addEventListener("click", () => {
              if (!hasDone(a.build)) { toast(dom, `Сначала построй: ${BUILDINGS[a.build].name}`, "warn"); return; }
              if (state.coins < a.price) { toast(dom, "Не хватает монет", "warn"); return; }
              state.coins -= a.price;
              const b = state.buildings.find((x) => x.id === a.build && x.done);
              state.animals.push({
                kind: id,
                x: +(b.x + (Math.random() - 0.5) * 1.6).toFixed(2),
                z: +(b.z + 2.4 + Math.random()).toFixed(2),
                fed: true,
                prog: 0,
                ready: false,
              });
              toast(dom, `${a.name} поселилась на ферме!`, "good");
              syncAnimalMeshes();
              render();
              refreshHud();
              saveSoon();
            });
          }
        }
      };
      for (const pair of [["build", "Постройки"], ["decor", "Декор"], ["animals", "Животные"]]) {
        const t = el("button", "tab", tabs);
        t.textContent = pair[1];
        t.addEventListener("click", () => { tab = pair[0]; render(); });
      }
      render();
    });
  }

  // ---------- Размещение построек ----------

  function startPlacement(listKey, id) {
    closePanel(dom);
    const price = listKey === "decor" ? DECOR[id].price : BUILDINGS[id].price;
    if (state.coins < buildPrice(price)) {
      toast(dom, "Не хватает монет", "warn");
      return;
    }
    buildMode = { listKey, id };
    const src = listKey === "decor" && id === "birch"
      ? world.birch(PALETTE, 0, 0)
      : world.buildingMesh(id);
    ghost = src;
    ghost.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.55;
      }
    });
    ghost.position.set(0, 0, 4);
    scene.add(ghost);
    toast(dom, "Выбери место и тапни по земле", "good", 3600);
  }

  function cancelBuild() {
    if (ghost) {
      scene.remove(ghost);
      ghost = null;
    }
    buildMode = null;
    refreshActionBtn();
  }

  function groundPoint(cx, cy) {
    const r = dom.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const p = new THREE.Vector3();
    return raycaster.ray.intersectPlane(groundPlane, p) ? p : null;
  }

  function placeValid(p) {
    if (p.x < -10.5 || p.x > 10.5 || p.z < -10.5 || p.z > 12) return false;
    const all = [...state.beds, ...state.buildings, ...state.decor, ...state.clutter];
    for (const o of all) {
      if (Math.hypot(o.x - p.x, o.z - p.z) < 1.7) return false;
    }
    if (Math.hypot(p.x + 6, p.z + 6) < 4) return false;
    if (Math.hypot(p.x, p.z - 8) < 2) return false;
    return true;
  }

  function tryPlaceAt(cx, cy) {
    if (!buildMode || !ghost) return;
    const p = groundPoint(cx, cy);
    if (!p) return;
    if (!placeValid(p)) { toast(dom, "Здесь нельзя ставить", "warn"); return; }
    const listKey = buildMode.listKey;
    const id = buildMode.id;
    const price = listKey === "decor" ? DECOR[id].price : BUILDINGS[id].price;
    state.coins -= buildPrice(price);
    const name = listKey === "decor" ? DECOR[id].name : BUILDINGS[id].name;
    recapAdd("coin", `Постройка (${name}): -${buildPrice(price)}`);
    if (listKey === "decor") {
      state.decor.push({ id, x: +p.x.toFixed(2), z: +p.z.toFixed(2) });
      toast(dom, `${name}: поставлено`, "good");
    } else {
      state.buildings.push({ id, x: +p.x.toFixed(2), z: +p.z.toFixed(2), hoursLeft: BUILDINGS[id].hours, done: false });
      toast(dom, `${name}: стройка начата — рабочие уже трудятся`, "good");
    }
    cancelBuild();
    rebuildWorldObjects();
    refreshHud();
    saveSoon();
  }

  // ---------- Диалоги ----------

  const DIALOGS = {
    nyura: [
      "Здравствуй, внук Ивана! Дедушка частенько у меня чай пил.",
      "Посади редиску — она в любой холод вырастет.",
      "Помогай мне, а я поделюсь семенами.",
    ],
    ashot: [
      "Свежие семена! Только у меня!",
      "Золотая рыбка? Принесёшь — дорого заплачу.",
      "Постоянным клиентам — скидка!",
    ],
    senya: [
      "Трактор мой, конечно, ржавый, но работает!",
      "Покорми кур — они тебе яиц нанесут.",
      "Постройку осилю в два счёта!",
    ],
    vika: [
      "Животных любить надо, и они отплатят молоком.",
      "Приходи, покажу, как шерсть стричь.",
      "Ферма деда Ивана оживает — чудо!",
    ],
    fil: [
      "В реке карась да плотва, а ночью сом бродит.",
      "Улучшу тебе удочку — будет улов побольше.",
      "Зимой на налима ходи — только в холода берёт.",
    ],
    petrovich: [
      "Двадцать лет строю — сруб встанет как вкопанный.",
      "Материалы только качественные!",
      "Оплату вперёд — таков порядок.",
    ],
    gosha: [
      "Быстрее всех построю, спорим?",
      "Кладку мою любой инспектор похвалит.",
      "Работать люблю, платить не забывай.",
    ],
  };

  function talk(who) {
    const nb = NEIGHBORS[who];
    if (!nb) return;
    const lines = DIALOGS[who] || ["Привет!"];
    const line = lines[Math.floor(Math.random() * lines.length)];
    openPanel(dom, "panel-talk", (body, panel, h2) => {
      h2.textContent = nb.name;
      const wrap = el("div", "note", body);
      wrap.style.display = "flex";
      wrap.style.gap = "12px";
      wrap.style.alignItems = "center";
      wrap.appendChild(portraitEl(who, 64));
      const txt = el("div", "", wrap);
      txt.textContent = line;
      const foot = el("div", "panel-foot", body.parentElement);
      const gift = el("button", "big-btn", foot);
      gift.textContent = "Сделать подарок (что любит)";
      gift.addEventListener("click", () => {
        const want = nb.wants.find((id) => inv(id) > 0);
        if (!want) {
          toast(dom, `Нужно: ${nb.wants.map((w) => ITEMS[w].name).join(", ")}`, "warn");
          return;
        }
        take(want, 1);
        state.friendship[who] = Math.min(5, (state.friendship[who] || 0) + 1);
        checkFriendGift(who);
        toast(dom, `${nb.name} рад! Дружба +1`, "gift");
        closePanel(dom);
        refreshHud();
        saveSoon();
      });
    });
  }

  // ---------- Реклама (имитация rewarded) ----------

  let adTimer = 0;
  let adLayer = null;
  let adText = null;
  let adCb = null;

  function showAd(onDone) {
    if (adLayer) return;
    adLayer = el("div", "scrim", dom.surface);
    const card = el("div", "loading-card", adLayer);
    adText = el("h2", "", card);
    adText.textContent = "📺 Реклама: 3";
    adTimer = 2.1;
    adCb = onDone;
  }

  function watchAdForRain() {
    showAd(() => {
      rainFlash = 1;
      for (const b of state.beds) {
        if (b.crop && !b.done) b.watered = true;
      }
      for (const b of state.buildings) {
        if (!b.done) b.hoursLeft = Math.max(0, b.hoursLeft - 4);
      }
      toast(dom, "Дождь! Грядки политы, стройки ускорены", "good", 3600);
      rebuildWorldObjects();
      refreshHud();
      saveSoon();
    });
  }

  // ---------- Рыбалка ----------

  function openRiver() {
    openPanel(dom, "panel-river", (body, panel, h2) => {
      h2.textContent = "Река Берёзовка";
      const b1 = el("button", "big-btn", body);
      b1.textContent = "🎣 Рыбалка";
      b1.addEventListener("click", () => {
        closePanel(dom);
        startFishing();
      });
      const b2 = el("button", "big-btn", body);
      b2.textContent = "💧 Набрать воды";
      b2.addEventListener("click", () => {
        state.water = waterMax();
        toast(dom, "Ведро полное!", "good");
        closePanel(dom);
        refreshHud();
      });
      el("div", "hint", body).textContent = "Ночью клюёт сом, а зимой — налим. Золотая рыбка — большая редкость!";
    });
  }

  function startFishing() {
    if (fishing) return;
    const zoneSize = Math.min(0.5, (0.2 + state.rodLevel * 0.06) * FISH_ZONE);
    fishing = {
      phase: "wait",
      t: 0,
      biteAt: 1.6 + Math.random() * 2.6,
      marker: 0.5,
      dir: 1,
      zonePos: 0.2 + Math.random() * 0.6,
      zoneSize,
      overlay: null,
      markerEl: null,
      labelEl: null,
    };
    const overlay = el("div", "fish-overlay", dom.surface);
    const pill = el("div", "fish-pill", overlay);
    pill.appendChild(svg("fish", "ico-svg"));
    const label = el("span", "", pill);
    label.textContent = "Ждём поклёвку…";
    const reel = el("div", "reel", overlay);
    const zone = el("div", "reel-zone", reel);
    zone.style.height = zoneSize * 100 + "%";
    zone.style.bottom = (fishing.zonePos - zoneSize / 2) * 100 + "%";
    const marker = el("div", "reel-marker", reel);
    marker.style.display = "none";
    const hint = el("div", "note", overlay);
    hint.textContent = "Когда клюнет — жми кнопку действия!";
    fishing.overlay = overlay;
    fishing.markerEl = marker;
    fishing.labelEl = label;
    dom.actionIco.replaceChildren(svg("fish", "ico-svg"));
    dom.actionLabel.textContent = "Подсекать!";
  }

  function fishingAction() {
    if (!fishing) return;
    if (fishing.phase === "wait") {
      endFishing("Рано! Рыба уплыла…", "warn");
      return;
    }
    const dist = Math.abs(fishing.marker - fishing.zonePos);
    if (dist <= fishing.zoneSize / 2) {
      const fish = pickFish();
      state.fishCaught[fish] = (state.fishCaught[fish] || 0) + 1;
      give(fish, 1);
      recapAdd(fish, `Улов: ${ITEMS[fish].name}`);
      endFishing(`Поймал: ${ITEMS[fish].name}!`, "good");
    } else {
      endFishing("Мимо… Рыба сорвалась", "warn");
    }
  }

  function pickFish() {
    const season = seasonOf(state);
    const night = isNight(state);
    const pool = FISH.filter((f) => f.seasons.includes(season) && (!f.night || night));
    const total = pool.reduce((s, f) => s + f.weight, 0);
    let r = Math.random() * total;
    for (const f of pool) {
      r -= f.weight;
      if (r <= 0) return f.id;
    }
    return pool[0].id;
  }

  function endFishing(msg, kind) {
    if (fishing && fishing.overlay) fishing.overlay.remove();
    fishing = null;
    toast(dom, msg, kind, 3000);
    refreshHud();
    saveSoon();
  }

  // ---------- Сон и время ----------

  function openSleep() {
    openPanel(dom, "panel-sleep", (body, panel, h2) => {
      h2.textContent = "Дом деда Ивана";
      const note = el("div", "note", body);
      note.textContent = "Во сне грядки растут, животные дают продукцию, рабочие строят.";
      const btn = el("button", "big-btn", body);
      btn.textContent = "😴 Спать до утра";
      btn.addEventListener("click", () => {
        closePanel(dom);
        sleep();
      });
    });
  }

  function sleep() {
    const recap = [];
    for (const b of state.beds) {
      b.watered = false;
    }
    for (const a of state.animals) {
      if (a.fed) {
        a.prog += state.gifts && state.gifts.vika ? 1.5 : 1;
        if (a.prog >= ANIMALS[a.kind].every) {
          a.ready = true;
          a.prog = 0;
        }
        a.fed = false;
      }
    }
    for (const b of state.buildings) {
      if (b.done) continue;
      b.hoursLeft -= 8 * workersCount() * BUILD_SPD;
      if (b.hoursLeft <= 0) {
        b.hoursLeft = 0;
        b.done = true;
        recap.push({ ico: b.id, text: `Построено: ${BUILDINGS[b.id].name}` });
      }
    }
    const prevSeason = Math.floor((state.day - 1) / 7) % 4;
    state.day += 1;
    state.minutes = 6 * 60;
    state.water = waterMax();
    const newSeason = seasonOf(state);
    if (newSeason !== prevSeason) {
      recap.push({ ico: "sun", text: `Наступил сезон: ${SEASONS[newSeason]}` });
      if (newSeason === 3) {
        const dead = state.beds.filter((b) => b.crop && !b.greenhouse);
        for (const b of dead) {
          b.crop = null;
          b.stage = 0;
          b.done = false;
        }
        if (dead.length) recap.push({ ico: "moon", text: "Зима: открытые грядки очистились" });
      }
    }
    makeOrders();
    state.recap = recap;
    world.applySeason(newSeason);
    rebuildWorldObjects();
    save();
    showMorning();
  }

  function showMorning() {
    const layer = el("div", "scrim", dom.surface);
    const card = el("div", "morning", layer);
    el("div", "morning-sun", card);
    const h2 = el("h2", "", card);
    h2.textContent = `День ${((state.day - 1) % SEASON_DAYS) + 1}`;
    const sub = el("div", "morning-sub", card);
    sub.textContent = `${SEASONS[seasonOf(state)]} · ${state.day}-й день на ферме`;
    const recapBox = el("div", "recap", card);
    if (state.recap && state.recap.length) {
      for (const r of state.recap) {
        const row = el("div", "recap-row", recapBox);
        row.appendChild(itemIcon(r.ico, 22));
        const span = el("span", "recap-ico", row);
        span.textContent = r.text;
      }
    } else {
      el("div", "note", recapBox).textContent = "Спокойная ночь без событий.";
    }
    const btn = el("button", "big-btn", card);
    btn.textContent = "Начать день ☀️";
    btn.addEventListener("click", () => layer.remove());
  }

  function makeOrders() {
    state.orders = [];
    const pool = Object.keys(NEIGHBORS);
    for (let i = 0; i < 3 && pool.length; i++) {
      const who = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      const wants = NEIGHBORS[who].wants;
      const itemId = wants[Math.floor(Math.random() * wants.length)];
      const n = 1 + Math.floor(Math.random() * 2);
      const reward = Math.round((ITEMS[itemId].sell * n * 1.6) / 5) * 5;
      state.orders.push({ who, needs: { [itemId]: n }, reward });
    }
  }

  function advanceTime(dt) {
    state.minutes += (dt / DAY_LENGTH) * 1200;
    let rebuilt = false;
    for (const b of state.beds) {
      if (!b.crop || b.done || !b.watered) continue;
      const crop = CROPS[b.crop];
      b.stage += (dt / DAY_LENGTH) * 20 * GROWTH;
      const vis = Math.min(3, Math.max(1, Math.ceil((b.stage / crop.hours) * 3)));
      if (b.vis !== vis) {
        b.vis = vis;
        rebuilt = true;
      }
      if (b.stage >= crop.hours) {
        b.stage = crop.hours;
        b.done = true;
        recapAdd(b.crop, `${crop.name}: созрело`);
        toast(dom, `${crop.name} созрел — можно собирать!`, "good");
      }
    }
    if (rebuilt) rebuildWorldObjects();
    if (state.minutes >= 26 * 60) {
      toast(dom, "Уже 2:00 — пора спать!", "warn");
      sleep();
    }
  }

  // ---------- Сохранение ----------

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("[save] не удалось сохранить:", e);
    }
  }

  function saveSoon() {
    saveTimer = 29;
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return { ...newState(), ...data };
    } catch (e) {
      console.error("[save] сейв повреждён:", e);
      return null;
    }
  }

  // ---------- Выбор героя ----------

  function showChoose() {
    dom.hud.classList.add("choosing");
    const layer = el("div", "scrim", dom.surface);
    const card = el("div", "choose", layer);
    el("div", "choose-title", card).textContent = "Кто унаследует ферму?";
    const cards = el("div", "choose-cards", card);
    const heroes = [
      ["max", "Максим", "Программист из Москвы. Ищет смысл жизни"],
      ["masha", "Маша", "Дизайнер из Питера. Мечтает о своём деле"],
    ];
    for (const h of heroes) {
      const c = el("button", "hero-card", cards);
      c.appendChild(portraitEl(h[0], 84));
      const nm = el("div", "", c);
      nm.textContent = h[1];
      const sub = el("div", "choose-sub", c);
      sub.textContent = h[2];
      c.addEventListener("click", async () => {
        state.hero = h[0];
        layer.remove();
        dom.hud.classList.remove("choosing");
        await spawnHero();
        startWorld();
        toast(dom, `${h[1]} приезжает в Берёзовку! Ферма деда Ивана — теперь твоя.`, "good", 5000);
        toast(dom, "Подойди к грядке и посади редис — семена уже в рюкзаке", "good", 6000);
      });
    }
  }

  // ---------- Жизненный цикл ----------

  async function preload() {
    const loading = el("div", "loading", dom.root);
    const card = el("div", "loading-card", loading);
    el("div", "loading-sprout", card);
    const lt = el("div", "", card);
    lt.textContent = "Загрузка фермы…";

    initScene();
    try {
      await loadAtlases();
    } catch (e) {
      console.error("[preload] " + e.message);
    }
    await spawnNPCs();
    const saved = load();
    if (saved) {
      Object.assign(state, saved);
      state.recap = state.recap || [];
      state.gifts = state.gifts || {};
    } else {
      starterFarm();
    }
    loading.remove();

    if (state.hero) {
      await spawnHero();
      startWorld();
    } else {
      showChoose();
    }
  }

  function starterFarm() {
    const beds = [];
    for (const z of [1.6, 3.4]) {
      for (const x of [-1.8, 0, 1.8]) beds.push({ x, z, crop: null, stage: 0, watered: false, done: false, greenhouse: false });
    }
    state.beds = beds;
    state.clutter = [
      { x: -5, z: 3, kind: "stone" },
      { x: 4.5, z: -2, kind: "stone" },
      { x: 6, z: 5.5, kind: "stump" },
      { x: -7, z: -1, kind: "stump" },
      { x: -3.5, z: 6.5, kind: "weed" },
      { x: 2.5, z: 6.8, kind: "weed" },
      { x: 0.5, z: -4, kind: "weed" },
    ];
  }

  function startWorld() {
    if (started) return;
    started = true;
    world.applySeason(seasonOf(state));
    rebuildWorldObjects();
    refreshHud();
    refreshActionBtn();
    bindInput();
    if (!state.orders.length) makeOrders();
  }

  function moveHero(dt, t) {
    const hero = actors.hero;
    if (!hero) return;
    let dx = 0;
    let dz = 0;
    if (keys.KeyW || keys.ArrowUp) dz -= 1;
    if (keys.KeyS || keys.ArrowDown) dz += 1;
    if (keys.KeyA || keys.ArrowLeft) dx -= 1;
    if (keys.KeyD || keys.ArrowRight) dx += 1;
    dx += joy.dx;
    dz += joy.dy;
    const len = Math.hypot(dx, dz);
    const moving = len > 0.12;
    if (moving) {
      const scale = Math.max(1, len);
      dx /= scale;
      dz /= scale;
      const sp = WALK * Math.min(1, len);
      const p = hero.obj.position;
      let nx = p.x + dx * sp * dt;
      let nz = p.z + dz * sp * dt;
      nx = Math.min(18.6, Math.max(-14.5, nx));
      nz = Math.min(21, Math.max(-14.5, nz));
      const onPier = nz > 2.4 && nz < 5.6;
      if (nx > 15.2 && !onPier) nx = 15.2;
      p.set(nx, p.y, nz);
      hero.obj.rotation.y = Math.atan2(dx, dz);
      walkAnim(hero.rig, t);
    } else {
      idleAnim(hero.rig, t);
    }
  }

  function updateNPCs(dt, t) {
    for (const entry of Object.entries(actors)) {
      const id = entry[0];
      const npc = entry[1];
      if (id === "hero" || !npc) continue;
      npc.wait -= dt;
      const p = npc.obj.position;
      if (!npc.target && npc.wait <= 0) {
        const a = Math.random() * Math.PI * 2;
        const r = 0.6 + Math.random() * 1.4;
        npc.target = new THREE.Vector3(npc.anchor.x + Math.cos(a) * r, 0, npc.anchor.z + Math.sin(a) * r);
      }
      if (npc.target) {
        const d = npc.target.clone().sub(p);
        d.y = 0;
        if (d.length() < 0.1) {
          npc.target = null;
          npc.wait = 2 + Math.random() * 4;
          idleAnim(npc.rig, t);
        } else {
          d.normalize();
          p.addScaledVector(d, 0.9 * dt);
          npc.obj.rotation.y = Math.atan2(d.x, d.z);
          walkAnim(npc.rig, t, 0.6);
        }
      } else {
        idleAnim(npc.rig, t);
      }
    }
  }

  function updateAnimals() {
    for (const entry of animalMeshes) {
      const a = entry[0];
      const m = entry[1];
      m.t += 0.016;
      if (m.rig.head) m.rig.head.rotation.x = Math.sin(m.t * 2.4) * 0.18;
      if (a.kind === "chicken" && m.rig.wing_left) {
        m.rig.wing_left.rotation.z = Math.sin(m.t * 6) * 0.12;
        if (m.rig.wing_right) m.rig.wing_right.rotation.z = -Math.sin(m.t * 6) * 0.12;
      }
      if (m.rig.body) m.rig.body.rotation.z = Math.sin(m.t * 3) * 0.03;
      m.obj.position.set(a.x, 0, a.z);
    }
  }

  function updateSky() {
    const p = Math.min(1, Math.max(0, (state.minutes - 360) / 1200));
    const e = Math.sin(p * Math.PI);
    const dayC = new THREE.Color(0x9fd8f0);
    const setC = new THREE.Color(0xf2b070);
    const nightC = new THREE.Color(0x18203a);
    let sky;
    if (e > 0.25) {
      sky = dayC;
    } else if (e > 0) {
      sky = nightC.clone().lerp(setC, e / 0.25);
      if (e > 0.12) sky.lerp(dayC, (e - 0.12) / 0.13);
    } else {
      sky = nightC.clone().lerp(setC, Math.max(0, 1 + e * 6));
    }
    if (rainFlash > 0) {
      sky.lerp(new THREE.Color(0x6a7a8a), 0.4 * rainFlash);
      rainFlash = Math.max(0, rainFlash - 0.01);
    }
    scene.background.copy(sky);
    scene.fog.color.copy(sky);
    const ang = p * Math.PI;
    sun.position.set(Math.cos(ang) * 20, Math.max(2, Math.sin(ang) * 24), 10);
    sun.intensity = Math.max(0.08, e * 1.15);
    hemi.intensity = 0.25 + e * 0.6;
    ambient.intensity = 0.12 + e * 0.18;
  }

  function updateCamera() {
    const hero = actors.hero;
    if (!hero) return;
    const p = hero.obj.position;
    const z = camZoom * CAM_ZOOM_TWEAK;
    camera.position.lerp(new THREE.Vector3(p.x, p.y + 10.5 * z, p.z + 8.5 * z), 0.12);
    camera.lookAt(p.x, p.y + 0.6, p.z - 1);
  }

  function frame() {
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;

    if (started && !fishing) advanceTime(dt);

    moveHero(dt, t);
    updateNPCs(dt, t);
    updateAnimals();
    updateSky();
    updateCamera();

    for (const m of trackedMeshes) {
      const link = m.userData.link;
      if (link && link.kind === "building" && link.ref.id === "mill" && link.ref.done) {
        const blades = m.getObjectByName("blades");
        if (blades) blades.rotation.z += dt * 0.7;
      }
    }

    if (fishing && fishing.phase === "wait") {
      fishing.t += dt;
      if (fishing.t >= fishing.biteAt) {
        fishing.phase = "bite";
        fishing.markerEl.style.display = "";
        fishing.labelEl.textContent = "Клюёт! Лови!";
      }
    }
    if (fishing && fishing.phase === "bite") {
      fishing.marker += fishing.dir * dt * 0.9;
      if (fishing.marker > 1) { fishing.marker = 1; fishing.dir = -1; }
      if (fishing.marker < 0) { fishing.marker = 0; fishing.dir = 1; }
      fishing.markerEl.style.bottom = fishing.marker * 100 + "%";
    }

    if (adTimer > 0) {
      adTimer -= dt;
      if (adText) adText.textContent = "📺 Реклама: " + Math.max(1, Math.ceil(adTimer / 0.7));
      if (adTimer <= 0) {
        if (adLayer) adLayer.remove();
        adLayer = null;
        adText = null;
        adTimer = 0;
        const cb = adCb;
        adCb = null;
        if (cb) cb();
      }
    }

    for (let i = toastQueue.length - 1; i >= 0; i -= 1) {
      toastQueue[i].ttl -= dt;
      if (toastQueue[i].ttl <= 0) {
        toastQueue[i].el.remove();
        toastQueue.splice(i, 1);
      }
    }

    hudTimer += dt;
    if (hudTimer > 0.15) {
      hudTimer = 0;
      refreshHud();
      refreshActionBtn();
      updateBubbles();
    }

    saveTimer += dt;
    if (saveTimer > 30) {
      saveTimer = 0;
      save();
    }

    renderer.render(scene, camera);
  }

  return {
    preload,
    start() {
      bindInput();
      renderer.setAnimationLoop(frame);
    },
    state,
    hooks: {
      state,
      heroPos: () => (actors.hero ? actors.hero.obj.position.toArray() : null),
      sleep,
      startFishing,
      makeOrders,
      openShop,
      openOrders,
      openBuild,
      openDiary,
      openBackpack,
      showMorning,
    },
  };
}
