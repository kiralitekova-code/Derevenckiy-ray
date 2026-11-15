// Browser runtime for playing the game outside the Playabl Creator iframe.
export async function createStandaloneRuntime(assetsManifest, tweaksManifest) {
  const values = Object.fromEntries(
    Object.entries(tweaksManifest).map(([key, item]) => [key, item.value]),
  );
  const listeners = new Map();
  const tweaks = {
    async init() {
      return {
        get(key) { return values[key]; },
        subscribe(key, fn) {
          if (!listeners.has(key)) listeners.set(key, new Set());
          listeners.get(key).add(fn);
          return () => listeners.get(key)?.delete(fn);
        },
      };
    },
  };
  const assets = {
    async register() {
      return {
        get(key) {
          const asset = assetsManifest[key];
          if (!asset?.src) throw new Error(`Asset "${key}" is missing from assets.json`);
          return asset.src;
        },
      };
    },
  };
  const saveKey = "derevenckiy-ray.save.v1";
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let audioContext = null;
  const sdk = {
    gameState: {
      async load() {
        try { return JSON.parse(localStorage.getItem(saveKey) || "null"); }
        catch { return null; }
      },
      async save(data) { localStorage.setItem(saveKey, JSON.stringify(data)); },
      async clear() { localStorage.removeItem(saveKey); },
    },
    audio: {
      async getContext() {
        if (!AudioContextClass) throw new Error("Web Audio is not supported in this browser");
        audioContext ||= new AudioContextClass();
        return {
          context: audioContext,
          unlock: () => audioContext.resume(),
          onStateChange: (fn) => audioContext.addEventListener("statechange", fn),
        };
      },
    },
    device: { haptics: { isSupported: () => false, vibrate() {} } },
    ads: { isAvailable: () => false, async showRewarded() { return { status: "failed" }; } },
  };
  const run = {
    frozen: false,
    restart() {
      game.hooks.init(game.state);
      previous = 0;
    },
  };
  const { createGame } = await import("./game/game.js");
  const game = createGame({ mount: document.querySelector("#app"), sdk, ready: null, tweaks: await tweaks.init(), assets: await assets.register() });
  await game.preload();
  game.hooks.init(game.state);
  let previous = 0;
  let frame = 0;
  const loop = (now) => {
    if (document.hidden) { previous = now; frame = requestAnimationFrame(loop); return; }
    const dt = previous ? Math.min(0.05, (now - previous) / 1000) : 0;
    previous = now;
    if (!run.frozen) game.hooks.update(game.state, dt);
    game.hooks.render(game.state);
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  const stop = () => {
    cancelAnimationFrame(frame);
    game.destroy();
    audioContext?.close().catch(() => {});
  };
  window.addEventListener("pagehide", stop, { once: true });
  return { game, run, stop };
}
