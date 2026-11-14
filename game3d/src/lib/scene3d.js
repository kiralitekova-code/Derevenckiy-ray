// Мини-набор 3D-хелперов для процедурных моделей (fallback, если GLB не загрузился).
// jointedLimb возвращает группу-шарнир: повешенная на неё геометрия качается вместе с шарниром.

import * as THREE from "three";

export function jointedLimb({ length = 0.6, radius = 0.09, color = 0xffffff, flatShading = true, roughness = 0.85 } = {}) {
  const joint = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, flatShading, roughness });
  const geo = new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 3, 8);
  const limb = new THREE.Mesh(geo, material);
  limb.position.y = -length / 2;
  limb.castShadow = true;
  limb.receiveShadow = true;
  joint.add(limb);
  return { joint, limb };
}
