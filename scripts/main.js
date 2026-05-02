const MODULE_ID = "foundry-table-companion";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initialising`);
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Ready`);
  ui.notifications.info("Foundry Table Companion loaded.");
});