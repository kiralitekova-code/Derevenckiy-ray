import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages project sites are served below /<repository-name>/.
  base: process.env.GITHUB_ACTIONS ? "/Derevenckiy-ray/" : "/",
  build: { sourcemap: true },
});
