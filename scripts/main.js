import { registerSettings } from "./settings.js";

const MODULE_ID = "simple-companion";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initialising`);
  registerSettings();
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Ready`);
  ui.notifications.info("Simple Companion loaded.");
});