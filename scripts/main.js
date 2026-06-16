const MODULE_ID = "simple-companion";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | v2.0.0 initialising`);
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | v2.0.0 ready`);
  ui.notifications.info("Simple Companion v2.0.0 loaded.");
});
