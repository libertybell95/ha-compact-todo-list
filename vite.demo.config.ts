import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

// Serves demo/index.html: the card running against an in-memory mock of Home Assistant.
export default defineConfig({
  root: "demo",
  define: {
    __CARD_VERSION__: JSON.stringify(`${pkg.version}-demo`),
  },
});
