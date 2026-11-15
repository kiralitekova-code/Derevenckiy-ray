import sdk from "@playabl/sdk";
import assetsManifest from "../assets.json";
import assetsValues from "../assets.values.json";
import tweaksManifest from "../tweaks.json";
import tweaksValues from "../tweaks.values.json";
import "./styles.css";

if (window.parent !== window) {
  // Inside Playabl: preserve the Creator SDK, saves, ads, and editor integration.
  const { createDevtools } = await import("./game/devtools.js");
  const { createGame } = await import("./game/game.js");
  const ready = await sdk.ready();
  const tweaks = await sdk.tweaks.init(tweaksManifest, { values: tweaksValues });
  if (import.meta.hot) import.meta.hot.accept("../tweaks.values.json");
  const assets = await sdk.assets.register(assetsManifest, { values: assetsValues });
  const game = createGame({ mount: document.querySelector("#app"), sdk, ready, tweaks, assets });
  await game.preload();
  const run = await sdk.game.run(game.hooks, { state: game.state });
  game.attachRun(run);
  try {
    await sdk.devtools.init(createDevtools({ mount: document.querySelector("#app"), game, run }));
  } catch (error) {
    console.warn("[playabl] Creator Tools did not start; the game runs without them.", error);
  }
} else {
  // Top-level browser: use local saves and a requestAnimationFrame game loop.
  const { createStandaloneRuntime } = await import("./standalone.js");
  await createStandaloneRuntime(assetsManifest, tweaksManifest);
}
