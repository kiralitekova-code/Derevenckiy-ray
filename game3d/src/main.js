import { createGame } from "./game/game.js";
import tweaksValues from "./tweaks.values.json";
import "./styles.css";

const app = document.querySelector("#app");

const tweaks = { values: tweaksValues };
const game = createGame({ mount: app, tweaks });
window.__game = game;
await game.preload();
game.start();
