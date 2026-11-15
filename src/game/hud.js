// The DOM layer over the 3D world: HUD badges, the joystick and buttons,
// world-anchored bubbles and floating labels, toasts, the fishing overlay and
// the bottom-sheet panels (screens). Buttons only queue commands into state.
import {
	ANIMALS, BUILDINGS, BUILDING_ORDER, CROPS, CROP_ORDER, DECOR, DECOR_ORDER, FISH, FISH_ORDER, HEARTS_MAX,
	ITEMS, NEIGHBORS, NEIGHBOR_ORDER, SEASONS, WATER_MAX, WORKERS, WORKER_ORDER,
} from "./data.js";
import { atlasIcon, svg } from "./icons.js";
import { animalRoom, buildPrice, canFulfil, shopPrice } from "./actions.js";
import { bagCap, bagCount, cropStage, dayInSeason, freeWorker, seasonOf } from "./sim.js";

const SEASON_NAME = Object.fromEntries(SEASONS.map((s) => [s.id, s.name]));
const SEASON_IN = { spring: "весна", summer: "лето", autumn: "осень", winter: "зима" };

export function createHud(root, state, { onAd }) {
	root.insertAdjacentHTML(
		"beforeend",
		`
<div class="anchors" aria-hidden="true"></div>
<div class="safe-area hud">
  <div class="hud-top hud-row">
    <div class="hud-cluster">
      <div class="badge pill coins" data-node="coins">${atlasIcon(["ITEM_ICONS", "coin"], "atlas coin-ico")}<b class="coins-val">0</b></div>
      <div class="badge pill water" data-node="water">${svg("water")}<span class="water-val">12</span></div>
    </div>
    <div class="hud-cluster right">
      <div class="badge pill clock" data-node="clock"><span class="clock-ico"></span><span class="clock-day"></span><span class="clock-time"></span></div>
      <button class="pill-btn rain-btn" data-cmd="rain" hidden>${svg("play", "ico-svg small")}${svg("rain")}<span class="control-label">Дождь</span></button>
    </div>
  </div>
  <div class="toast-zone"><div class="toast" hidden></div></div>
  <div class="fish-overlay" hidden></div>
  <div class="joy-zone"><div class="joy"><div class="knob"></div></div></div>
  <div class="controls">
    <div class="side-btns">
      <button class="round-btn" data-cmd="orders" aria-label="Заказы">${svg("scroll")}<span class="dot" hidden></span></button>
      <button class="round-btn" data-cmd="build" aria-label="Стройка">${svg("hammer")}</button>
      <button class="round-btn bag-btn" data-cmd="bag" aria-label="Рюкзак">${svg("bag")}</button>
    </div>
    <div class="action-col">
      <button class="seed-chip" data-cmd="seeds" aria-label="Семена"></button>
      <button class="action-btn" data-cmd="action" aria-label="Действие"><span class="action-ico"></span></button>
      <span class="action-label control-label"></span>
    </div>
  </div>
</div>
<div class="scrim" hidden></div>
<div class="safe-area panel-layer" hidden><section class="panel" role="dialog"></section></div>
`,
	);
	const $ = (s) => root.querySelector(s);
	const el = {
		anchors: $(".anchors"),
		coins: $(".coins-val"), coinsBadge: $(".coins"),
		water: $(".water-val"), waterBadge: $(".water"),
		clockIco: $(".clock-ico"), clockDay: $(".clock-day"), clockTime: $(".clock-time"),
		rain: $(".rain-btn"),
		toast: $(".toast"),
		fish: $(".fish-overlay"),
		joy: $(".joy"), knob: $(".knob"), joyZone: $(".joy-zone"),
		ordersDot: $(".dot"),
		bagBtn: $(".bag-btn"),
		seed: $(".seed-chip"),
		action: $(".action-btn"), actionIco: $(".action-ico"), actionLabel: $(".action-label"),
		scrim: $(".scrim"), layer: $(".panel-layer"), panel: $(".panel"),
		hud: $(".hud"),
	};

	// Every button queues a command; update() performs it.
	root.addEventListener("click", (e) => {
		const b = e.target.closest("[data-cmd]");
		if (!b || b.disabled) return;
		// Ads must start inside the tap itself, so they bypass the queue.
		if (b.dataset.cmd === "rain" || b.dataset.cmd === "rush") {
			onAd(b.dataset.cmd, b.dataset.arg ?? null);
			return;
		}
		state.queue.push({ type: "cmd", cmd: b.dataset.cmd, arg: b.dataset.arg ?? null, arg2: b.dataset.arg2 ?? null });
	});
	// The action button acts on press, not release, and repeats while held.
	el.action.addEventListener("pointerdown", (e) => {
		e.preventDefault();
		state.input.actionHeld = true;
		state.queue.push({ type: "action" });
	});
	const release = () => { state.input.actionHeld = false; };
	el.action.addEventListener("pointerup", release);
	el.action.addEventListener("pointercancel", release);
	el.action.addEventListener("pointerleave", release);
	el.scrim.addEventListener("click", () => state.queue.push({ type: "cmd", cmd: "close" }));

	// --- World-anchored DOM: bubbles over people/animals/lots, floating labels --------------
	const bubbles = new Map();
	function bubble(id) {
		let b = bubbles.get(id);
		if (!b) {
			b = document.createElement("div");
			b.className = "bubble";
			el.anchors.appendChild(b);
			bubbles.set(id, { el: b, html: "", used: true });
			b = bubbles.get(id);
		}
		b.used = true;
		return b;
	}
	const floats = [];
	function addFloat(f) {
		const d = document.createElement("div");
		d.className = "float";
		d.innerHTML = `${f.icon ? atlasIcon(f.icon, "atlas float-ico") : ""}<span>${f.text}</span>`;
		el.anchors.appendChild(d);
		floats.push({ ...f, el: d, t: 0 });
	}
	function stepFloats(dt) {
		for (let i = floats.length - 1; i >= 0; i--) {
			floats[i].t += dt;
			if (floats[i].t > 1.3) {
				floats[i].el.remove();
				floats.splice(i, 1);
			}
		}
	}

	// --- Toasts ---------------------------------------------------------------------------
	const toasts = [];
	let toastT = 0;
	let toastShown = null;
	function addToast(t) {
		if (toasts.length && toasts[toasts.length - 1].text === t.text) return;
		if (toastShown && toastShown.text === t.text) { toastT = 0; return; }
		toasts.push(t);
		if (toasts.length > 3) toasts.shift();
	}
	function stepToasts(dt) {
		if (toastShown) {
			toastT += dt;
			if (toastT > Math.min(3.6, 1.6 + toastShown.text.length * 0.035)) toastShown = null;
		}
		if (!toastShown && toasts.length) {
			toastShown = toasts.shift();
			toastT = 0;
		}
	}

	// --- Panels ------------------------------------------------------------------------------
	let panelKey = "";
	function setPanel(html, key) {
		if (key === panelKey) return;
		panelKey = key;
		const scroll = el.panel.querySelector(".panel-body")?.scrollTop ?? 0;
		el.panel.innerHTML = html;
		const body = el.panel.querySelector(".panel-body");
		if (body) body.scrollTop = scroll;
	}

	const head = (title, extra = "") => `<header class="panel-head"><h2>${title}</h2>${extra}<button class="icon-btn" data-cmd="close" aria-label="Закрыть">${svg("close")}</button></header>`;
	const tabs = (list, active) => `<nav class="tabs">${list.map(([id, label]) => `<button class="tab${id === active ? " on" : ""}" data-cmd="tab" data-arg="${id}"><span class="control-label">${label}</span></button>`).join("")}</nav>`;
	const coinsTag = (n, can = true) => `<span class="price${can ? "" : " short"}">${atlasIcon(["ITEM_ICONS", "coin"], "atlas price-ico")}${n}</span>`;
	const hearts = (n) => `<span class="pip-row hearts">${Array.from({ length: HEARTS_MAX }, (_, i) => `<span class="pip${i < n ? " on" : ""}">${svg("heart", "ico-svg pip-ico")}</span>`).join("")}</span>`;

	function panelChoose() {
		return `<div class="choose">
      <h2 class="choose-title">Кто приехал в Берёзовку?</h2>
      <div class="choose-cards">
        <button class="hero-card" data-cmd="hero" data-arg="max">${atlasIcon(["PORTRAITS", "max"], "atlas hero-portrait")}<span class="control-label">Максим</span></button>
        <button class="hero-card" data-cmd="hero" data-arg="masha">${atlasIcon(["PORTRAITS", "masha"], "atlas hero-portrait")}<span class="control-label">Маша</span></button>
      </div>
      <p class="choose-sub">Ферма деда Ивана ждёт нового хозяина</p>
    </div>`;
	}

	function panelBag(cfg) {
		const farm = state.farm;
		const tab = state.ui.tab || "seeds";
		let body = "";
		if (tab === "seeds") {
			const season = seasonOf(farm, cfg.seasonDays);
			const owned = CROP_ORDER.filter((c) => farm.seeds[c] > 0);
			body = owned.length
				? `<div class="grid">${owned.map((c) => {
					const ok = CROPS[c].seasons.includes(season);
					return `<button class="cell${farm.selectedSeed === c ? " sel" : ""}${ok ? "" : " off"}" data-cmd="select-seed" data-arg="${c}">${atlasIcon(ITEMS[c].icon, "atlas cell-ico")}<span class="cell-name">${CROPS[c].name}</span><span class="cell-count">×${farm.seeds[c]}</span>${ok ? "" : `<span class="cell-note">не сезон</span>`}</button>`;
				}).join("")}</div>`
				: `<p class="empty">Семян нет. Их продаёт Ашот в лавке на востоке.</p>`;
		} else if (tab === "items") {
			const items = Object.entries(farm.inv).filter(([, n]) => n > 0);
			body = items.length
				? `<div class="grid">${items.map(([i, n]) => `<div class="cell">${atlasIcon(ITEMS[i].icon, "atlas cell-ico")}<span class="cell-name">${ITEMS[i].name}</span><span class="cell-count">×${n}</span></div>`).join("")}</div>`
				: `<p class="empty">Пусто. Собирай урожай, яйца и рыбу.</p>`;
		} else {
			body = `<div class="grid">${FISH_ORDER.map((f) => {
				const n = farm.journal[f] || 0;
				const seasons = FISH[f].seasons.map((s) => SEASON_IN[s]).join(", ");
				return `<div class="cell${n ? "" : " unknown"}">${atlasIcon(ITEMS[f].icon, "atlas cell-ico")}<span class="cell-name">${n ? ITEMS[f].name : "???"}</span><span class="cell-note">${n ? `поймано ${n}` : FISH[f].night ? "ночью" : f === "goldfish" ? "редкая" : seasons}</span></div>`;
			}).join("")}</div>`;
		}
		const fishCount = Object.keys(farm.journal).length;
		return `${head("Рюкзак", `<span class="cap">${bagCount(farm)}/${bagCap(farm)}</span>`)}
      ${tabs([["seeds", "Семена"], ["items", "Вещи"], ["fish", `Улов ${fishCount}/8`]], tab)}
      <div class="panel-body">${body}</div>
      <footer class="panel-foot"><button class="pill-btn" data-cmd="mute">${svg(farm.muted ? "soundOff" : "soundOn")}<span class="control-label">${farm.muted ? "Звук выкл" : "Звук вкл"}</span></button></footer>`;
	}

	function panelShop(cfg) {
		const farm = state.farm;
		const tab = state.ui.tab || "buy";
		const season = seasonOf(farm, cfg.seasonDays);
		const order = farm.orders.find((o) => o.npc === "ashot");
		let body = "";
		if (tab === "buy") {
			const list = [...CROP_ORDER].sort((a, b) => Number(!CROPS[a].seasons.includes(season)) - Number(!CROPS[b].seasons.includes(season)));
			body = list.map((c) => {
				const def = CROPS[c];
				const ok = def.seasons.includes(season) || farm.buildings.greenhouse.state === "done";
				const price = shopPrice(farm, def.seed);
				return `<div class="row${ok ? "" : " off"}">${atlasIcon(ITEMS[c].icon, "atlas row-ico")}
          <div class="row-main"><b>${def.name}</b><small>${def.seasons.map((s) => SEASON_IN[s]).join(", ")} · ${def.hours} ч${def.yield > 1 ? ` · ×${def.yield}` : ""} · продаж ${ITEMS[c].sell}</small></div>
          ${coinsTag(price, farm.coins >= price)}
          <button class="buy-btn" data-cmd="buy-seed" data-arg="${c}" data-arg2="1" ${farm.coins >= price ? "" : "disabled"}><span class="control-label">+1</span></button>
          <button class="buy-btn" data-cmd="buy-seed" data-arg="${c}" data-arg2="5" ${farm.coins >= price * 5 ? "" : "disabled"}><span class="control-label">+5</span></button>
        </div>`;
			}).join("");
		} else if (tab === "farm") {
			const hay = shopPrice(farm, ITEMS.hay.buy);
			body = `<div class="row">${atlasIcon(ITEMS.hay.icon, "atlas row-ico")}<div class="row-main"><b>Сено</b><small>корм на день · у тебя ${farm.inv.hay || 0}</small></div>${coinsTag(hay)}
        <button class="buy-btn" data-cmd="buy-hay" data-arg="1" ${farm.coins >= hay ? "" : "disabled"}><span class="control-label">+1</span></button>
        <button class="buy-btn" data-cmd="buy-hay" data-arg="5" ${farm.coins >= hay * 5 ? "" : "disabled"}><span class="control-label">+5</span></button></div>`;
			body += Object.entries(ANIMALS).map(([k, def]) => {
				const room = animalRoom(farm, k);
				const price = shopPrice(farm, def.price);
				const homeName = BUILDINGS[def.home].name;
				const note = farm.buildings[def.home].state !== "done" ? `нужен ${homeName.toLowerCase()}` : room > 0 ? `мест: ${room} · даёт ${ITEMS[def.product].name.toLowerCase()}` : "мест нет";
				return `<div class="row${room > 0 ? "" : " off"}">${atlasIcon(["BUILD_ICONS", k], "atlas row-ico")}<div class="row-main"><b>${def.name}</b><small>${note}</small></div>${coinsTag(price, farm.coins >= price)}
          <button class="buy-btn wide" data-cmd="buy-animal" data-arg="${k}" ${room > 0 && farm.coins >= price ? "" : "disabled"}><span class="control-label">Купить</span></button></div>`;
			}).join("");
		} else {
			const items = Object.entries(farm.inv).filter(([, n]) => n > 0);
			const total = items.filter(([i]) => i !== "hay").reduce((s, [i, n]) => s + ITEMS[i].sell * n, 0);
			body = items.length
				? items.map(([i, n]) => `<div class="row">${atlasIcon(ITEMS[i].icon, "atlas row-ico")}<div class="row-main"><b>${ITEMS[i].name} ×${n}</b><small>по ${ITEMS[i].sell}</small></div>
          <button class="buy-btn" data-cmd="sell" data-arg="${i}" data-arg2="1"><span class="control-label">1</span></button>
          <button class="buy-btn wide" data-cmd="sell" data-arg="${i}" data-arg2="999"><span class="control-label">Все · ${ITEMS[i].sell * n}</span></button></div>`).join("")
					+ (total ? `<button class="big-btn" data-cmd="sell-all"><span class="control-label">Продать всё (кроме сена) · ${total}</span></button>` : "")
				: `<p class="empty">Продавать пока нечего.</p>`;
		}
		const orderNote = order ? `<div class="note">${atlasIcon(["PORTRAITS", "ashot"], "atlas note-ico")}<span>Ашот ждёт: ${Object.entries(order.items).map(([i, n]) => `${ITEMS[i].name} ×${n}`).join(", ")} · ${order.reward}</span></div>` : "";
		return `${head(tab === "sell" ? "Продажа" : "Лавка Ашота", `<span class="cap">${coinsTag(farm.coins)}</span>`)}
      ${tabs([["buy", "Семена"], ["farm", "Хозяйство"], ["sell", "Продать"]], tab)}
      <div class="panel-body">${tab === "sell" ? "" : orderNote}${body}</div>`;
	}

	function panelBuild(cfg, ads) {
		const farm = state.farm;
		const tab = state.ui.tab || "buildings";
		let body = "";
		const lot = state.ui.lot;
		if (tab === "buildings") {
			const free = freeWorker(farm);
			const order = lot ? [lot, ...BUILDING_ORDER.filter((b) => b !== lot)] : BUILDING_ORDER;
			body = order.map((id) => {
				const def = BUILDINGS[id];
				const b = farm.buildings[id];
				const price = buildPrice(farm, id);
				let right = "";
				if (b.state === "done") right = `<span class="status ok">${svg("check", "ico-svg small")}Готово</span>`;
				else if (b.state === "building") {
					const pct = Math.floor((b.progress / def.hours) * 100);
					const left = Math.max(0, def.hours - b.progress);
					right = `<div class="progress"><div class="bar"><i style="width:${pct}%"></i></div><small>${WORKERS[b.worker]?.name ?? ""} · ещё ${Math.ceil(left)} ч</small></div>`;
					if (ads.rewarded && !state.adPending) right += `<button class="ad-btn" data-cmd="rush" data-arg="${id}">${svg("play", "ico-svg small")}<span class="control-label">Реклама: достроить</span></button>`;
				} else {
					right = `${coinsTag(price, farm.coins >= price)}<button class="buy-btn wide" data-cmd="start-build" data-arg="${id}" ${free && farm.coins >= price ? "" : "disabled"}><span class="control-label">${free ? "Строить" : "Нет рабочих"}</span></button>`;
				}
				return `<div class="row build-row${id === lot ? " focus" : ""}">${atlasIcon(["BUILD_ICONS", id], "atlas row-ico big")}<div class="row-main"><b>${def.name}</b><small>${def.hint} · ${def.hours} ч</small></div>${right}</div>`;
			}).join("");
		} else if (tab === "decor") {
			body = `<div class="grid">${DECOR_ORDER.map((k) => {
				const can = farm.coins >= DECOR[k].price;
				return `<button class="cell" data-cmd="buy-decor" data-arg="${k}" ${can ? "" : "disabled"}>${atlasIcon(["BUILD_ICONS", k], "atlas cell-ico")}<span class="cell-name">${DECOR[k].name}</span>${coinsTag(DECOR[k].price, can)}</button>`;
			}).join("")}</div>`;
		} else {
			body = WORKER_ORDER.map((w) => {
				const info = farm.workers[w];
				const def = WORKERS[w];
				const status = info.hired ? (info.job ? `строит: ${BUILDINGS[info.job].name.toLowerCase()}` : "свободен") : "ищет работу";
				const right = info.hired ? `<span class="status${info.job ? "" : " ok"}">${info.job ? svg("hammer", "ico-svg small") : svg("check", "ico-svg small")}${info.job ? "Занят" : "Готов"}</span>`
					: `${coinsTag(def.price, farm.coins >= def.price)}<button class="buy-btn wide" data-cmd="hire" data-arg="${w}" ${farm.coins >= def.price ? "" : "disabled"}><span class="control-label">Нанять</span></button>`;
				return `<div class="row">${atlasIcon(["PORTRAITS", def.portrait], "atlas row-ico portrait")}<div class="row-main"><b>${def.name}</b><small>${status}</small></div>${right}</div>`;
			}).join("");
			body += `<p class="hint">Каждый рабочий — ещё одна стройка одновременно.</p>`;
		}
		return `${head("Стройка", `<span class="cap">${coinsTag(farm.coins)}</span>`)}
      ${tabs([["buildings", "Постройки"], ["decor", "Декор"], ["workers", "Рабочие"]], tab)}
      <div class="panel-body">${body}</div>`;
	}

	function panelOrders() {
		const farm = state.farm;
		const cards = farm.orders.map((o) => {
			const n = NEIGHBORS[o.npc];
			const can = canFulfil(farm, o);
			const items = Object.entries(o.items).map(([i, k]) => {
				const have = Math.min(farm.inv[i] || 0, k);
				return `<span class="need${have >= k ? " done" : ""}">${atlasIcon(ITEMS[i].icon, "atlas need-ico")}<b>${have}/${k}</b></span>`;
			}).join("");
			return `<div class="order${can ? " ready" : ""}">${atlasIcon(["PORTRAITS", o.npc], "atlas order-portrait")}
        <div class="order-main"><div class="order-top"><b>${n.name}</b>${hearts(farm.friends[o.npc])}</div><div class="needs">${items}</div>
        <small>${can ? `Можно отдать — подойди к ${n.dative}` : `Отнеси ${n.dative}`}</small></div>
        ${coinsTag(o.reward)}</div>`;
		}).join("");
		const friends = NEIGHBOR_ORDER.map((npc) => `<div class="friend">${atlasIcon(["PORTRAITS", npc], "atlas friend-ico")}<div class="row-main"><b>${NEIGHBORS[npc].name}</b><small>${farm.bonuses[npc] ? `${svg("star", "ico-svg small")} ${NEIGHBORS[npc].bonus}` : `3 ♥: ${NEIGHBORS[npc].bonus.toLowerCase()}`}</small></div>${hearts(farm.friends[npc])}</div>`).join("");
		return `${head("Заказы соседей")}<div class="panel-body">${cards || `<p class="empty">Заказов нет — загляни завтра.</p>`}<h3 class="sub">Дружба</h3>${friends}</div>`;
	}

	function panelMorning(cfg) {
		const farm = state.farm;
		const season = seasonOf(farm, cfg.seasonDays);
		const list = (state.recap || []).map((e) => `<li>${e.icon ? atlasIcon(e.icon, "atlas recap-ico") : `<span class="recap-svg">${svg(e.rain ? "rain" : e.season ? "sun" : e.order ? "scroll" : e.ripe ? "sprout" : "star")}</span>`}<span>${e.text}</span></li>`).join("");
		return `<div class="morning">
      <div class="morning-sun">${svg("sun")}</div>
      <h2>${SEASON_NAME[season]} · День ${dayInSeason(farm, cfg.seasonDays)}</h2>
      <p class="morning-sub">${state.recapPassedOut ? "Ты уснул прямо на ходу… Доброе утро!" : "Доброе утро, Берёзовка!"}</p>
      <ul class="recap">${list || "<li><span>Тихая ночь. Новый день — новые дела.</span></li>"}</ul>
      <button class="big-btn" data-cmd="close"><span class="control-label">Новый день</span></button>
    </div>`;
	}

	function renderPanel(cfg, ads) {
		const scr = state.screen;
		el.layer.hidden = !scr;
		el.scrim.hidden = !scr;
		if (!scr) {
			panelKey = "";
			return;
		}
		el.panel.className = `panel ${scr.replace("screen:", "p-")}`;
		const farm = state.farm;
		const key = JSON.stringify([scr, state.ui, farm.coins, farm.inv, farm.seeds, farm.selectedSeed, farm.muted, farm.workers,
			Object.values(farm.buildings).map((b) => [b.state, Math.floor((b.progress || 0) * 4)]), farm.orders.length, farm.animals.length, ads.rewarded, state.adPending, state.recap?.length]);
		let html = "";
		if (scr === "screen:choose") html = panelChoose();
		else if (scr === "screen:bag") html = panelBag(cfg);
		else if (scr === "screen:shop") html = panelShop(cfg);
		else if (scr === "screen:build") html = panelBuild(cfg, ads);
		else if (scr === "screen:orders") html = panelOrders();
		else if (scr === "screen:morning") html = panelMorning(cfg);
		setPanel(html, key);
	}

	// --- Fishing overlay ------------------------------------------------------------------------
	let fishKey = "";
	function renderFishing() {
		const f = state.fishing;
		el.fish.hidden = !f;
		if (!f) {
			fishKey = "";
			return;
		}
		const key = `${f.phase}:${f.result}:${f.fish}`;
		if (key !== fishKey) {
			fishKey = key;
			let html = "";
			if (f.phase === "cast" || f.phase === "wait") html = `<div class="fish-pill">${svg("fish")}<span>Ждём поклёвку…</span></div>`;
			else if (f.phase === "bite") html = `<div class="fish-bite">!</div><div class="fish-pill hot"><span>Подсекай!</span></div>`;
			else if (f.phase === "reel") html = `<div class="reel"><div class="reel-zone"></div><div class="reel-marker"></div></div><div class="fish-pill"><span>Жми в зелёной зоне</span></div>`;
			else if (f.result === "caught") html = `<div class="catch">${atlasIcon(ITEMS[f.fish].icon, "atlas catch-ico")}<b>${ITEMS[f.fish].name}</b><span>${coinsTag(ITEMS[f.fish].sell)}</span></div>`;
			else html = `<div class="fish-pill miss"><span>${f.result === "missed" ? "Не успел — рыба ушла" : f.result === "full" ? "Рюкзак полон" : "Сорвалась!"}</span></div>`;
			el.fish.innerHTML = html;
		}
		if (f.phase === "reel") {
			const zone = el.fish.querySelector(".reel-zone");
			const marker = el.fish.querySelector(".reel-marker");
			if (zone) {
				zone.style.left = `${f.zone * 100}%`;
				zone.style.width = `${f.zoneW * 100}%`;
			}
			if (marker) marker.style.left = `${f.marker * 100}%`;
		}
	}

	// --- Per-frame render -------------------------------------------------------------------------
	let shownCoins = null;
	let coinPulse = 0;
	let lastAction = "";
	let lastSeed = "";
	function render(ctx) {
		const farm = state.farm;
		const { cfg, project, npcPos, ads } = ctx;
		const season = seasonOf(farm, cfg.seasonDays);

		if (shownCoins !== farm.coins) {
			if (shownCoins !== null && farm.coins > shownCoins) coinPulse = 1;
			shownCoins = farm.coins;
			el.coins.textContent = farm.coins.toLocaleString("ru-RU");
		}
		el.coinsBadge.classList.toggle("pulse", coinPulse > 0.5);
		el.water.textContent = `${farm.water}/${WATER_MAX}`;
		el.waterBadge.classList.toggle("empty", farm.water === 0);
		const h = Math.floor(farm.hour) % 24;
		const m = Math.floor((farm.hour % 1) * 6) * 10;
		const night = farm.hour >= 20 || farm.hour < 6;
		el.clockIco.innerHTML = svg(night ? "moon" : "sun");
		el.clockDay.textContent = `${SEASON_NAME[season]} · День ${dayInSeason(farm, cfg.seasonDays)}`;
		el.clockTime.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
		el.clockTime.classList.toggle("late", farm.hour >= 23);

		const growing = farm.plots.some((p) => p.crop && cropStage(p) < 3);
		el.rain.hidden = !(ads.rewarded && !state.adPending && growing && !state.screen && !state.fishing);
		el.ordersDot.hidden = !farm.orders.some((o) => canFulfil(farm, o));

		// Action button.
		const f = state.fishing;
		let icon = "hand", label = "", disabled = true;
		if (f) {
			icon = "fish";
			disabled = false;
			label = f.phase === "bite" ? "Подсечь!" : f.phase === "reel" ? "Тянуть!" : f.phase === "result" ? "Дальше" : "Смотать";
		} else if (state.target) {
			icon = state.target.icon;
			label = state.target.label;
			disabled = !!state.target.disabled;
		}
		const ak = `${icon}|${label}|${disabled}|${f?.phase === "bite"}`;
		if (ak !== lastAction) {
			lastAction = ak;
			el.actionIco.innerHTML = svg(icon, "ico-svg action-svg");
			el.actionLabel.textContent = label;
			el.action.classList.toggle("off", disabled);
			el.action.classList.toggle("hot", f?.phase === "bite");
		}
		// Bag button turns into "cancel" while placing decor.
		el.bagBtn.dataset.cmd = state.placing ? "cancel-place" : "bag";
		el.bagBtn.innerHTML = svg(state.placing ? "close" : "bag");

		const seed = farm.selectedSeed && farm.seeds[farm.selectedSeed] > 0 ? farm.selectedSeed : null;
		const sk = `${seed}:${seed ? farm.seeds[seed] : 0}:${state.target?.icon === "seed"}`;
		if (sk !== lastSeed) {
			lastSeed = sk;
			el.seed.innerHTML = seed ? `${atlasIcon(ITEMS[seed].icon, "atlas seed-ico")}<b>${farm.seeds[seed]}</b>` : `${svg("seed")}<b>0</b>`;
			el.seed.classList.toggle("want", state.target?.icon === "seed");
		}

		// Bubbles.
		for (const b of bubbles.values()) b.used = false;
		const showWorld = !state.screen;
		if (showWorld) {
			for (const o of farm.orders) {
				const [x, z] = npcPos(o.npc);
				const can = canFulfil(farm, o);
				const first = Object.keys(o.items)[0];
				placeBubble(`npc:${o.npc}`, x, 2.35, z, `${atlasIcon(ITEMS[first].icon, "atlas bubble-ico")}${can ? `<span class="bub-ok">${svg("check", "ico-svg tiny")}</span>` : ""}`, can ? "ready" : "");
			}
			for (const a of farm.animals) {
				const y = a.kind === "cow" ? 2.1 : a.kind === "sheep" ? 1.5 : 0.95;
				if (a.ready) placeBubble(`an:${a.id}`, a.x, y, a.z, atlasIcon(ITEMS[ANIMALS[a.kind].product].icon, "atlas bubble-ico"), "ready small");
				else if (!a.fed) placeBubble(`an:${a.id}`, a.x, y, a.z, atlasIcon(ITEMS.hay.icon, "atlas bubble-ico"), "small hungry");
			}
			for (const [id, b] of Object.entries(farm.buildings)) {
				if (b.state !== "building") continue;
				const def = BUILDINGS[id];
				const pct = Math.floor((b.progress / def.hours) * 100);
				placeBubble(`lot:${id}`, def.x, id === "mill" ? 5.2 : 3.6, def.z, `${svg("hammer", "ico-svg tiny")}<b>${pct}%</b>`, "progress-bub");
			}
		}
		for (const [id, b] of bubbles) {
			if (!b.used) {
				b.el.remove();
				bubbles.delete(id);
			}
		}
		function placeBubble(id, x, y, z, html, cls) {
			const b = bubble(id);
			if (b.html !== html + cls) {
				b.el.innerHTML = html;
				b.el.className = `bubble ${cls}`;
				b.html = html + cls;
			}
			const s = project(x, y, z);
			b.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
			b.el.style.visibility = s.behind ? "hidden" : "";
		}

		for (const fl of floats) {
			const s = project(fl.x, fl.y + fl.t * 0.9, fl.z);
			fl.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%) scale(${fl.t < 0.15 ? 0.6 + fl.t * 2.7 : 1})`;
			fl.el.style.opacity = String(fl.t > 0.9 ? Math.max(0, 1 - (fl.t - 0.9) / 0.4) : 1);
		}

		// Toast.
		el.toast.hidden = !toastShown || !!state.screen;
		if (toastShown && el.toast.dataset.text !== toastShown.text) {
			el.toast.dataset.text = toastShown.text;
			el.toast.textContent = toastShown.text;
			el.toast.className = `toast ${toastShown.tone || ""}`;
		}

		el.hud.classList.toggle("choosing", state.screen === "screen:choose");
		renderFishing();
		renderPanel(cfg, ads);
	}

	function step(dt) {
		stepFloats(dt);
		stepToasts(dt);
		coinPulse = Math.max(0, coinPulse - dt * 2.5);
	}

	return {
		el,
		render,
		step,
		addFloat,
		addToast,
		rects() {
			const r = (n) => n.getBoundingClientRect();
			return {
				coins: r(el.coinsBadge), water: r(el.waterBadge), clock: r(root.querySelector(".clock")),
				action: r(el.action), joy: r(el.joyZone), side: r(root.querySelector(".side-btns")),
			};
		},
	};
}
