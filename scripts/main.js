import {registerSettings} from "./settings.js";
import {PlayerDisplay} from "./playerDisplay.js";

const MODULE_ID = "simple-companion";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initialising`);
  registerSettings();
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Ready`);
  ui.notifications.info("Simple Companion loaded.");

  // remove for final, for now this will force launch all displays automatically
  for (let i = 1; i <= 4; i++) {
    new PlayerDisplay(i).render(true);
  }
});