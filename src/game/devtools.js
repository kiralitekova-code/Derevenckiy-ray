// The game's Creator Tools vocabulary: what exists (catalog), what is on
// screen (describeScene), and what the editor may drive. Commands call the
// game's own functions.
import { BUILDINGS, NEIGHBORS, NEIGHBOR_ORDER, WORKERS } from "./data.js";
import { plotCenter } from "./state.js";
import { cropStage, plotActive } from "./sim.js";

export function createDevtools({ mount, game, run }) {
	// A rect around a 3D object: projected base and top, width from height.
	function rectAt(x, z, height, ratio = 0.6) {
		const v = game.view;
		if (!v) return null;
		const host = mount.getBoundingClientRect();
		const top = v.project(x, height, z);
		const bottom = v.project(x, 0, z);
		const h = Math.max(8, bottom.y - top.y);
		const w = Math.max(8, h * ratio);
		return { x: host.left + bottom.x - w / 2, y: host.top + top.y, w, h };
	}
	const domRect = (r) => ({ x: r.left, y: r.top, w: r.width, h: r.height });

	return {
		game: "Деревенский Рай: Наследие",

		catalog({ definition, screen, keysFor }) {
			return {
				levels: [],
				screens: [
					screen("screen:choose", "Выбор героя", { tweakKeys: keysFor("screen:choose") }),
					screen("screen:bag", "Рюкзак", { tweakKeys: keysFor("screen:bag") }),
					screen("screen:shop", "Лавка Ашота", { tweakKeys: keysFor("screen:shop") }),
					screen("screen:build", "Стройка", { tweakKeys: keysFor("screen:build") }),
					screen("screen:orders", "Заказы соседей", { tweakKeys: keysFor("screen:orders") }),
					screen("screen:morning", "Итоги ночи", { tweakKeys: keysFor("screen:morning") }),
				],
				definitions: [
					definition("def:player", "Герой", { tweakKeys: keysFor("def:player"), nodeKinds: ["player"], category: "characters", sprite: "PORTRAITS", spriteFrame: "max" }),
					definition("def:camera", "Камера", { tweakKeys: keysFor("def:camera"), category: "system" }),
					definition("def:time", "Время и сезоны", { tweakKeys: keysFor("def:time"), category: "world" }),
					definition("def:world", "Берёзовка", { tweakKeys: keysFor("def:world"), nodeKinds: ["world"], category: "world" }),
					definition("def:plot", "Грядки", { tweakKeys: keysFor("def:plot"), nodeKinds: ["plot"], singleton: false, category: "world", sprite: "ITEM_ICONS", spriteFrame: "carrot" }),
					definition("def:building", "Постройки", { tweakKeys: keysFor("def:building"), nodeKinds: ["building"], singleton: false, category: "world", sprite: "BUILD_ICONS", spriteFrame: "barn" }),
					definition("def:worker", "Рабочие", { tweakKeys: keysFor("def:worker"), nodeKinds: ["worker"], singleton: false, category: "characters", sprite: "PORTRAITS", spriteFrame: "petrovich" }),
					definition("def:neighbor", "Соседи", { tweakKeys: keysFor("def:neighbor"), nodeKinds: ["neighbor"], singleton: false, category: "characters", sprite: "PORTRAITS", spriteFrame: "nyura" }),
					definition("def:chicken", "Куры", { tweakKeys: keysFor("def:chicken"), nodeKinds: ["chicken"], singleton: false, category: "characters", sprite: "BUILD_ICONS" }),
					definition("def:cow", "Коровы", { tweakKeys: keysFor("def:cow"), nodeKinds: ["cow"], singleton: false, category: "characters", sprite: "BUILD_ICONS" }),
					definition("def:sheep", "Овцы", { tweakKeys: keysFor("def:sheep"), nodeKinds: ["sheep"], singleton: false, category: "characters", sprite: "BUILD_ICONS" }),
					definition("def:decor", "Декор", { tweakKeys: keysFor("def:decor"), nodeKinds: ["decor"], singleton: false, category: "world", sprite: "BUILD_ICONS", spriteFrame: "flowerbed" }),
					definition("def:fishing", "Рыбалка", { tweakKeys: keysFor("def:fishing"), nodeKinds: ["fishing"], category: "world", sprite: "FISH_ICONS", spriteFrame: "perch" }),
					definition("def:fx", "Частицы и сезонные эффекты", { tweakKeys: keysFor("def:fx"), category: "effects" }),
					definition("def:hud-coins", "Монеты", { tweakKeys: keysFor("def:hud-coins"), nodeKinds: ["hud-coins"], category: "interface" }),
					definition("def:hud-water", "Лейка", { tweakKeys: keysFor("def:hud-water"), nodeKinds: ["hud-water"], category: "interface" }),
					definition("def:hud-clock", "Часы и сезон", { tweakKeys: keysFor("def:hud-clock"), nodeKinds: ["hud-clock"], category: "interface" }),
					definition("def:hud-actions", "Кнопка действия", { tweakKeys: keysFor("def:hud-actions"), nodeKinds: ["hud-actions"], category: "interface" }),
					definition("def:hud-menu", "Кнопки меню", { tweakKeys: keysFor("def:hud-menu"), nodeKinds: ["hud-menu"], category: "interface" }),
					definition("def:joystick", "Джойстик", { tweakKeys: keysFor("def:joystick"), nodeKinds: ["joystick"], category: "interface" }),
				],
			};
		},

		describeScene() {
			const s = game.state;
			const farm = s.farm;
			const nodes = [];
			const host = mount.getBoundingClientRect();
			nodes.push({ id: "world", defId: "def:world", kind: "world", label: "Берёзовка", rect: domRect(host), instance: {} });
			const push = (id, defId, kind, label, rect, instance = {}) => { if (rect) nodes.push({ id, defId, kind, label, rect, instance }); };
			for (const plot of farm.plots) {
				if (!plotActive(farm, plot)) continue;
				const [x, z] = plotCenter(plot);
				push(`plot-${plot.id}`, "def:plot", "plot", plot.crop ? `Грядка: ${plot.crop}` : "Грядка", rectAt(x, z, 0.6, 2.2), { crop: plot.crop, stage: cropStage(plot), watered: plot.watered });
			}
			for (const [id, b] of Object.entries(farm.buildings)) {
				const def = BUILDINGS[id];
				push(`building-${id}`, "def:building", "building", def.name, rectAt(def.x, def.z, b.state === "none" ? 1 : 3, b.state === "none" ? 3 : 1.4), { state: b.state });
			}
			for (const d of farm.decor) push(`decor-${d.id}`, "def:decor", "decor", d.kind, rectAt(d.x, d.z, 1.2, 1), { kind: d.kind });
			for (const a of farm.animals) push(`animal-${a.id}`, `def:${a.kind}`, a.kind, a.kind, rectAt(a.x, a.z, a.kind === "cow" ? 1.7 : a.kind === "sheep" ? 1.1 : 0.65, 1.1), { fed: a.fed, ready: a.ready });
			for (const npc of NEIGHBOR_ORDER) {
				const [x, z] = game.npcPos(npc);
				push(`npc-${npc}`, "def:neighbor", "neighbor", NEIGHBORS[npc].name, rectAt(x, z, 1.9), { hearts: farm.friends[npc] });
			}
			for (const w of ["petrovich", "gosha"]) {
				if (!farm.workers[w].hired) continue;
				const [x, z] = game.workerPos(w);
				push(`worker-${w}`, "def:worker", "worker", WORKERS[w].name, rectAt(x, z, 1.9), { job: farm.workers[w].job });
			}
			if (farm.hero) push("player", "def:player", "player", farm.hero === "masha" ? "Маша" : "Максим", rectAt(farm.player.x, farm.player.z, 1.9), { x: farm.player.x, z: farm.player.z });
			if (s.fishing) push("fishing", "def:fishing", "fishing", "Рыбалка", rectAt(-0.4, 16.6, 0.8, 1.5), { phase: s.fishing.phase });
			const hud = game.hud;
			if (hud) {
				const r = hud.rects();
				push("hud-coins", "def:hud-coins", "hud-coins", "Монеты", domRect(r.coins), { coins: farm.coins });
				push("hud-water", "def:hud-water", "hud-water", "Лейка", domRect(r.water), { water: farm.water });
				push("hud-clock", "def:hud-clock", "hud-clock", "Часы и сезон", domRect(r.clock), { day: farm.day });
				push("hud-actions", "def:hud-actions", "hud-actions", "Кнопка действия", domRect(r.action), {});
				push("hud-menu", "def:hud-menu", "hud-menu", "Кнопки меню", domRect(r.side), {});
				push("joystick", "def:joystick", "joystick", "Джойстик", domRect(r.joy), {});
			}
			return { nodes };
		},

		getState: () => {
			const farm = game.state.farm;
			return {
				screen: game.state.screen,
				hero: farm.hero,
				coins: farm.coins,
				day: farm.day,
				season: game.season(),
				hour: Math.round(farm.hour * 10) / 10,
				water: farm.water,
				orders: farm.orders.length,
				ripe: farm.plots.filter((p) => p.crop && cropStage(p) === 3).length,
				animals: farm.animals.length,
				fishing: game.state.fishing ? game.state.fishing.phase : null,
				target: game.state.target ? game.state.target.label : null,
			};
		},
		getScreen: () => game.getScreen(),
		showScreen: (id) => game.showScreen(id),
		commands: {
			"add-coins": { label: "+500 монет", icon: "Coins", description: "Добавить 500 монет", mutates: true, run: () => game.addCoins(500) },
			"next-day": { label: "Следующий день", icon: "Moon", description: "Лечь спать и начать новый день", mutates: true, run: () => game.sleep(false) },
			"grow-all": { label: "Вырастить всё", icon: "Sprout", description: "Сделать все посадки спелыми", mutates: true, run: () => game.growAll() },
			"new-farm": { label: "Новая ферма", icon: "RotateCcw", description: "Стереть сохранение и начать заново", mutates: true, run: () => { game.newFarm(); run.restart(); } },
		},
	};
}
