// Атласы игры (спрайт-листы из архива ассетов). Пути — файлы в public/assets/.
export const ATLASES = {
  items:     { src: "assets/resources/item_icons.webp",  cols: 4, rows: 3, parts: ["coin","radish","carrot","potato","wheat","sunflower","pumpkin","egg","milk","wool","flour","hay"] },
  fish:      { src: "assets/ui/fish_icons.webp",          cols: 4, rows: 2, parts: ["crucian","roach","perch","bream","pike","catfish","burbot","goldfish"] },
  builds:    { src: "assets/buildings/build_icons.webp",  cols: 4, rows: 4, parts: ["coop","cowshed","sheepfold","barn","well","mill","greenhouse","fence","flowerbed","scarecrow","lantern","bench","birch","chicken","cow","sheep"] },
  portraits: { src: "assets/portraits/portraits.webp",    cols: 3, rows: 3, parts: ["max","masha","nyura","ashot","senya","vika","fil","petrovich","gosha"] },
};

// GLB-модели (экспортированы из src/models/*.js, лежат в public/assets/3d/).
export const MODELS = {
  hero_max:   { src: "assets/3d/HERO_MAX.glb",   fallback: "hero_max" },
  hero_masha: { src: "assets/3d/HERO_MASHA.glb", fallback: "hero_masha" },
  nyura:      { src: "assets/3d/NYURA.glb",      fallback: "nyura" },
  ashot:      { src: "assets/3d/ASHOT.glb",      fallback: "ashot" },
  senya:      { src: "assets/3d/SENYA.glb",      fallback: "senya" },
  vika:       { src: "assets/3d/VIKA.glb",       fallback: "vika" },
  fil:        { src: "assets/3d/FIL.glb",        fallback: "fil" },
  petrovich:  { src: "assets/3d/PETROVICH.glb",  fallback: "petrovich" },
  gosha:      { src: "assets/3d/GOSHA.glb",      fallback: "gosha" },
  chicken:    { src: "assets/3d/CHICKEN.glb",    fallback: "chicken" },
  cow:        { src: "assets/3d/COW.glb",        fallback: "cow" },
  sheep:      { src: "assets/3d/SHEEP.glb",      fallback: "sheep" },
};
