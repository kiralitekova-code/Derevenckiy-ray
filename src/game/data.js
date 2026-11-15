// All the farm's content in one place: crops, items, animals, buildings,
// decor, fish, neighbours and workers. Numbers here are the game's balance.
// Coordinates are metres on the ground plane: -Z is north (the house), +Z is
// the river near the camera, +X is the village to the east.

export const DAY_START = 6; // 6:00
export const DAY_END = 26; // 2:00 next morning: the hero falls asleep
export const NIGHT_GROWTH_HOURS = 6;
export const NIGHT_BUILD_HOURS = 8;
export const WATER_MAX = 12;
export const BAG_BASE = 40;
export const BAG_BARN = 100;

export const SEASONS = [
	{ id: "spring", name: "Весна" },
	{ id: "summer", name: "Лето" },
	{ id: "autumn", name: "Осень" },
	{ id: "winter", name: "Зима" },
];

// hours = game hours of growth while watered (dry soil grows at half speed).
export const CROPS = {
	radish: { name: "Редис", seed: 10, hours: 5, yield: 1, seasons: ["spring"] },
	carrot: { name: "Морковь", seed: 20, hours: 9, yield: 1, seasons: ["spring", "summer"] },
	potato: { name: "Картофель", seed: 15, hours: 11, yield: 2, seasons: ["spring", "autumn"] },
	wheat: { name: "Пшеница", seed: 10, hours: 8, yield: 2, seasons: ["summer", "autumn"] },
	sunflower: { name: "Подсолнух", seed: 40, hours: 15, yield: 1, seasons: ["summer"] },
	pumpkin: { name: "Тыква", seed: 60, hours: 22, yield: 1, seasons: ["autumn"] },
};
export const CROP_ORDER = ["radish", "carrot", "potato", "wheat", "sunflower", "pumpkin"];

// icon: [atlas asset key, frame name]
export const ITEMS = {
	radish: { name: "Редис", sell: 25, icon: ["ITEM_ICONS", "radish"] },
	carrot: { name: "Морковь", sell: 50, icon: ["ITEM_ICONS", "carrot"] },
	potato: { name: "Картофель", sell: 30, icon: ["ITEM_ICONS", "potato"] },
	wheat: { name: "Пшеница", sell: 18, icon: ["ITEM_ICONS", "wheat"] },
	sunflower: { name: "Подсолнух", sell: 110, icon: ["ITEM_ICONS", "sunflower"] },
	pumpkin: { name: "Тыква", sell: 220, icon: ["ITEM_ICONS", "pumpkin"] },
	egg: { name: "Яйцо", sell: 30, icon: ["ITEM_ICONS", "egg"] },
	milk: { name: "Молоко", sell: 80, icon: ["ITEM_ICONS", "milk"] },
	wool: { name: "Шерсть", sell: 140, icon: ["ITEM_ICONS", "wool"] },
	flour: { name: "Мука", sell: 90, icon: ["ITEM_ICONS", "flour"] },
	hay: { name: "Сено", sell: 2, buy: 5, icon: ["ITEM_ICONS", "hay"] },
	crucian: { name: "Карась", sell: 30, icon: ["FISH_ICONS", "crucian"] },
	roach: { name: "Плотва", sell: 25, icon: ["FISH_ICONS", "roach"] },
	perch: { name: "Окунь", sell: 45, icon: ["FISH_ICONS", "perch"] },
	bream: { name: "Лещ", sell: 60, icon: ["FISH_ICONS", "bream"] },
	pike: { name: "Щука", sell: 120, icon: ["FISH_ICONS", "pike"] },
	catfish: { name: "Сом", sell: 180, icon: ["FISH_ICONS", "catfish"] },
	burbot: { name: "Налим", sell: 100, icon: ["FISH_ICONS", "burbot"] },
	goldfish: { name: "Золотая рыбка", sell: 500, icon: ["FISH_ICONS", "goldfish"] },
};

// zone: width of the catch window on the reel bar (0..1); speed: marker sweeps per second.
export const FISH = {
	crucian: { seasons: ["spring", "summer"], zone: 0.3, speed: 0.9, weight: 30 },
	roach: { seasons: ["spring", "summer", "autumn"], zone: 0.3, speed: 1.0, weight: 30 },
	perch: { seasons: ["spring", "summer", "autumn", "winter"], zone: 0.22, speed: 1.2, weight: 22 },
	bream: { seasons: ["summer", "autumn"], zone: 0.2, speed: 1.25, weight: 16 },
	pike: { seasons: ["spring", "autumn"], zone: 0.15, speed: 1.5, weight: 9 },
	catfish: { seasons: ["summer", "autumn"], zone: 0.14, speed: 1.55, weight: 12, night: true },
	burbot: { seasons: ["winter"], zone: 0.2, speed: 1.3, weight: 26 },
	goldfish: { seasons: ["spring", "summer", "autumn", "winter"], zone: 0.09, speed: 1.9, weight: 2 },
};
export const FISH_ORDER = ["crucian", "roach", "perch", "bream", "pike", "catfish", "burbot", "goldfish"];

export const ANIMALS = {
	chicken: { name: "Курица", price: 120, product: "egg", every: 1, home: "coop" },
	cow: { name: "Корова", price: 500, product: "milk", every: 1, home: "cowshed" },
	sheep: { name: "Овца", price: 350, product: "wool", every: 3, home: "sheepfold" },
};

// Each building has a fixed lot (ruins until built). pen = where its animals roam.
export const BUILDINGS = {
	coop: { name: "Курятник", cost: 300, hours: 6, x: -10.5, z: -5.2, w: 3, d: 2.4, capacity: 4, pen: [-13, -4.2, -7.5, 0.5], hint: "Дом для 4 кур" },
	cowshed: { name: "Коровник", cost: 900, hours: 10, x: -11.5, z: 3.6, w: 4.2, d: 3, capacity: 2, pen: [-14.5, 5.5, -7.5, 10], hint: "Дом для 2 коров" },
	sheepfold: { name: "Овчарня", cost: 700, hours: 9, x: 10.5, z: 3.2, w: 3.6, d: 2.6, capacity: 3, pen: [7, 5, 13.5, 10], hint: "Дом для 3 овец" },
	barn: { name: "Амбар", cost: 600, hours: 8, x: 7.8, z: -11, w: 4.2, d: 3.6, hint: "Рюкзак вмещает 100 вещей" },
	well: { name: "Колодец", cost: 250, hours: 4, x: -5.6, z: -6.6, w: 1.6, d: 1.6, hint: "Вода прямо у грядок" },
	mill: { name: "Мельница", cost: 1200, hours: 12, x: 13.4, z: -11.2, w: 3, d: 3, hint: "3 пшеницы → мука" },
	greenhouse: { name: "Теплица", cost: 1500, hours: 14, x: 8.6, z: -4.2, w: 4.2, d: 3.2, hint: "6 грядок, растут в любой сезон" },
};
export const BUILDING_ORDER = ["coop", "well", "barn", "cowshed", "sheepfold", "mill", "greenhouse"];

export const DECOR = {
	fence: { name: "Забор", price: 20 },
	flowerbed: { name: "Клумба", price: 40 },
	scarecrow: { name: "Пугало", price: 60 },
	lantern: { name: "Фонарь", price: 80 },
	bench: { name: "Скамейка", price: 70 },
	birch: { name: "Берёзка", price: 50 },
};
export const DECOR_ORDER = ["fence", "flowerbed", "scarecrow", "lantern", "bench", "birch"];

export const WORKERS = {
	senya: { name: "Сеня", price: 0, model: "SENYA_MODEL", portrait: "senya" },
	petrovich: { name: "Петрович", price: 400, model: "PETROVICH_MODEL", portrait: "petrovich" },
	gosha: { name: "Гоша", price: 800, model: "GOSHA_MODEL", portrait: "gosha" },
};
export const WORKER_ORDER = ["senya", "petrovich", "gosha"];
// Where idle hired workers wait on the farm.
export const WORKER_IDLE = { senya: [15.5, 3.2], petrovich: [3.4, -5.2], gosha: [4.6, -5.6] };

// Neighbours: where they stand, what they ask for, and the gift at 3 hearts.
export const NEIGHBORS = {
	nyura: {
		name: "Баба Нюра", dative: "Бабе Нюре", model: "NYURA_MODEL", x: 4.6, z: 1.0, face: -1.57,
		wants: ["radish", "carrot", "egg", "milk", "flour", "potato"],
		bonus: "Каждое утро дарит семена",
	},
	ashot: {
		name: "Ашот", dative: "Ашоту", model: "ASHOT_MODEL", x: 16.2, z: -5.2, face: -1.57,
		wants: ["pumpkin", "sunflower", "carrot", "pike", "bream", "wool"],
		bonus: "Скидка 10% в лавке",
	},
	senya: {
		name: "Сеня", dative: "Сене", model: "SENYA_MODEL", x: 15.5, z: 3.2, face: -1.57,
		wants: ["potato", "flour", "milk", "egg", "wheat"],
		bonus: "Постройки дешевле на 20%",
	},
	vika: {
		name: "Вика", dative: "Вике", model: "VIKA_MODEL", x: 3.6, z: 8.4, face: 0.4,
		wants: ["hay", "wool", "egg", "carrot", "milk"],
		bonus: "Животные приносят больше",
	},
	fil: {
		name: "Лесник Фил", dative: "Филу", model: "FIL_MODEL", x: -6.4, z: 10.6, face: 0.6,
		wants: ["crucian", "roach", "perch", "radish", "potato", "burbot"],
		bonus: "Дарит удочку получше",
	},
};
export const NEIGHBOR_ORDER = ["nyura", "ashot", "senya", "vika", "fil"];
export const HEARTS_MAX = 5;
export const BONUS_HEARTS = 3;

// The field: a 6×4 grid of plots, plus 6 greenhouse plots once it is built.
export const TILE = 1.3;
export const FIELD = { cols: 6, rows: 4, x: -0.4, z: -1.6 };
export const GREENHOUSE_PLOTS = { cols: 3, rows: 2 };

// Fixed places the player interacts with.
export const SPOTS = {
	door: [-1, -7.4],
	crate: [2.9, -7.3],
	stall: [16.2, -6.8],
	pierEnd: [-0.4, 15.6],
	riverZ: 11.6, // standing south of this (off the pier) means at the water's edge
};

export const BOUNDS = { minX: -16, maxX: 19, minZ: -15, maxZ: 11.9 };
export const PIER = { minX: -1.3, maxX: 0.5, minZ: 11, maxZ: 16.3 };
