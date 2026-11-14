// Загрузчик 3D-моделей: GLB через GLTFLoader, при ошибке — процедурная сборка
// из src/models/*.js, в крайнем случае — цветной куб-заглушка.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MODELS } from "./manifest.js";

const loader = new GLTFLoader();
const cache = {};

function procedural(key) {
  return import(`../models/${key}.js`).then((m) => m.default()).catch((e) => {
    console.error("[models] процедурная сборка не удалась:", key, e);
    return cubeFallback();
  });
}

function cubeFallback() {
  const g = new THREE.Group();
  g.name = "fallback-cube";
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 1, 0.6),
    new THREE.MeshStandardMaterial({ color: 0xc8a060, flatShading: true })
  );
  m.position.y = 0.5;
  m.castShadow = true;
  g.add(m);
  return g;
}

// Загружает модель по ключу. Возвращает THREE.Group с именованными узлами
// (head, leg_left, leg_right, arm_left, arm_right, wing_left, wing_right, body).
export async function loadModel(key) {
  if (cache[key]) return cache[key].clone(true);
  const def = MODELS[key];
  if (!def) throw new Error("Нет модели с ключом " + key);
  let obj = null;
  try {
    const gltf = await loader.loadAsync(def.src);
    obj = gltf.scene;
    obj.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
  } catch (e) {
    console.error("[models] GLB не загрузился:", def.src, e.message, "— использую процедурную сборку", def.fallback);
    obj = await procedural(def.fallback);
  }
  cache[key] = obj;
  return obj.clone(true);
}
