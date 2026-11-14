// Игровые данные и состояние сохранения.

export const SEASONS = ["Весна", "Лето", "Осень", "Зима"];

export const CROPS = {
  radish:    { name: "Редис",      seasons: [0],    hours: 5,  seed: 10, sell: 25, yield: 2 },
  carrot:    { name: "Морковь",    seasons: [0, 1], hours: 9,  seed: 20, sell: 24, yield: 2 },
  potato:    { name: "Картофель",  seasons: [0, 2], hours: 11, seed: 15, sell: 34, yield: 3 },
  wheat:     { name: "Пшеница",    seasons: [1, 2], hours: 8,  seed: 10, sell: 18, yield: 3 },
  sunflower: { name: "Подсолнух",  seasons: [1],    hours: 15, seed: 40, sell: 52, yield: 1 },
  pumpkin:   { name: "Тыква",      seasons: [2],    hours: 22, seed: 60, sell: 85, yield: 1 },
};

export const ITEMS = {
  coin: { name: "Монеты" },
  radish: { name: "Редис", atlas: ["items", "radish"], sell: 25 },
  carrot: { name: "Морковь", atlas: ["items", "carrot"], sell: 24 },
  potato: { name: "Картофель", atlas: ["items", "potato"], sell: 34 },
  wheat: { name: "Пшеница", atlas: ["items", "wheat"], sell: 18 },
  sunflower: { name: "Подсолнух", atlas: ["items", "sunflower"], sell: 52 },
  pumpkin: { name: "Тыква", atlas: ["items", "pumpkin"], sell: 85 },
  egg: { name: "Яйцо", atlas: ["items", "egg"], sell: 12 },
  milk: { name: "Молоко", atlas: ["items", "milk"], sell: 30 },
  wool: { name: "Шерсть", atlas: ["items", "wool"], sell: 45 },
  flour: { name: "Мука", atlas: ["items", "flour"], sell: 40 },
  hay: { name: "Сено", atlas: ["items", "hay"], sell: 8 },
  pie: { name: "Пирожки", atlas: ["items", "flour"], sell: 60 },
  crucian: { name: "Карась", atlas: ["fish", "crucian"], sell: 22 },
  roach: { name: "Плотва", atlas: ["fish", "roach"], sell: 26 },
  perch: { name: "Окунь", atlas: ["fish", "perch"], sell: 34 },
  bream: { name: "Лещ", atlas: ["fish", "bream"], sell: 44 },
  pike: { name: "Щука", atlas: ["fish", "pike"], sell: 60 },
  catfish: { name: "Сом", atlas: ["fish", "catfish"], sell: 90 },
  burbot: { name: "Налим", atlas: ["fish", "burbot"], sell: 95 },
  goldfish: { name: "Золотая рыбка", atlas: ["fish", "goldfish"], sell: 500 },
};

export const FISH = [
  { id: "crucian",  seasons: [0, 1, 2, 3], night: false, weight: 30 },
  { id: "roach",    seasons: [0, 1, 2, 3], night: false, weight: 26 },
  { id: "perch",    seasons: [0, 1, 2, 3], night: false, weight: 18 },
  { id: "bream",    seasons: [0, 1, 2, 3], night: false, weight: 12 },
  { id: "pike",     seasons: [0, 1, 2, 3], night: false, weight: 8 },
  { id: "catfish",  seasons: [0, 1, 2, 3], night: true,  weight: 10 },
  { id: "burbot",   seasons: [3],          night: true,  weight: 8 },
  { id: "goldfish", seasons: [0, 1, 2, 3], night: false, weight: 2 },
];

export const ANIMALS = {
  chicken: { name: "Курица", build: "coop", product: "egg", every: 1, price: 120, atlas: ["builds", "chicken"] },
  cow:     { name: "Корова", build: "cowshed", product: "milk", every: 1, price: 500, atlas: ["builds", "cow"] },
  sheep:   { name: "Овца",   build: "sheepfold", product: "wool", every: 3, price: 350, atlas: ["builds", "sheep"] },
};

export const BUILDINGS = {
  coop:       { name: "Курятник",  price: 300, hours: 10, desc: "Дом для 4 кур" },
  cowshed:    { name: "Коровник",  price: 900, hours: 16, desc: "Дом для 2 коров" },
  sheepfold:  { name: "Овчарня",   price: 700, hours: 14, desc: "Дом для 3 овец" },
  barn:       { name: "Амбар",     price: 600, hours: 12, desc: "Рюкзак вмещает больше (+12 слотов)" },
  well:       { name: "Колодец",   price: 250, hours: 8,  desc: "Вода прямо у дома (+4 воды)" },
  mill:       { name: "Мельница",  price: 1200, hours: 18, desc: "Зерно в муку, мука + яйцо → пирожки" },
  greenhouse: { name: "Теплица",   price: 1500, hours: 20, desc: "3 грядки, работающие зимой" },
};

export const DECOR = {
  fence:     { name: "Забор",    price: 20, hours: 1 },
  flowerbed: { name: "Клумба",   price: 40, hours: 1 },
  scarecrow: { name: "Пугало",   price: 60, hours: 2 },
  lantern:   { name: "Фонарь",   price: 80, hours: 2 },
  bench:     { name: "Скамейка", price: 70, hours: 2 },
  birch:     { name: "Берёзка",  price: 50, hours: 2 },
};

export const WORKERS = {
  senya:     { name: "Сеня-тракторист", price: 0,   desc: "Помогает сразу, за угощение" },
  petrovich: { name: "Петрович",        price: 400, desc: "Ищет работу" },
  gosha:     { name: "Гоша",            price: 800, desc: "Ищет работу" },
};

export const NEIGHBORS = {
  nyura: { name: "Баба Нюра", wants: ["egg", "milk", "carrot", "flour"] },
  ashot: { name: "Торговец Ашот", wants: ["pumpkin", "sunflower", "crucian", "perch"] },
  senya: { name: "Сеня-тракторист", wants: ["pie", "potato"] },
  vika:  { name: "Вика-ветеринар", wants: ["hay", "wool"] },
  fil:   { name: "Лесник Фил", wants: ["crucian", "roach", "perch"] },
};

export function newState() {
  return {
    hero: null,
    day: 1,
    minutes: 6 * 60,
    coins: 150,
    water: 9, waterMax: 12,
    inventory: { radish: 2, wheat: 3 },
    seeds: { radish: 4 },
    beds: [],
    cleared: [],
    clutter: [],
    buildings: [],
    decor: [],
    animals: [],
    workers: ["senya"],
    friendship: { nyura: 0, ashot: 0, senya: 0, vika: 0, fil: 0 },
    orders: [],
    fishCaught: {},
    rodLevel: 1,
    recap: [],
    tutorialDone: false,
  };
}

export function seasonOf(state) {
  return Math.floor((state.day - 1) / 7) % 4;
}

export function clockOf(state) {
  const h = Math.floor(state.minutes / 60) % 24;
  const m = Math.floor(state.minutes % 60);
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

export function isNight(state) {
  const h = Math.floor(state.minutes / 60) % 24;
  return h >= 21 || h < 6;
}
