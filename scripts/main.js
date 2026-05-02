import { registerSettings } from "./settings.js";
import { PlayerDisplay, activeDisplays } from "./playerDisplay.js";

const MODULE_ID = "simple-companion";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initialising`);
  registerSettings();
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Ready`);
  ui.notifications.info("Simple Companion loaded.");

  Hooks.on("updateActor", (actor) => {
    for (let i = 1; i <= 4; i++) {
      const display = activeDisplays[i];
      if (!display) continue;

      const actorId = game.settings.get(MODULE_ID, `player${i}ActorId`);
      if (actorId === actor.id) {
        display.refresh();
      }
    }
  });
});

Hooks.on("updateToken", (tokenDoc) => {
  for (let i = 1; i <= 4; i++) {
    const display = activeDisplays[i];
    if (!display) continue;

    const actorId = game.settings.get(MODULE_ID, `player${i}ActorId`);
    if (tokenDoc.actor?.id === actorId) {
      display.refresh();
    }
  }
});

Hooks.on("getSceneControlButtons", (controls) => {
  controls["simple-companion"] = {
    name: "simple-companion",
    title: "Simple Companion",
    icon: "fas fa-tablet-alt",
    layer: "tokens",
    order: 99,
    tools: {
      "open-display-1": {
        name: "open-display-1",
        title: "Open Display 1",
        icon: "fas fa-tv",
        button: true,
        onClick: () => new PlayerDisplay(1).render(true)
      },
      "open-display-2": {
        name: "open-display-2",
        title: "Open Display 2",
        icon: "fas fa-tv",
        button: true,
        onClick: () => new PlayerDisplay(2).render(true)
      },
      "open-display-3": {
        name: "open-display-3",
        title: "Open Display 3",
        icon: "fas fa-tv",
        button: true,
        onClick: () => new PlayerDisplay(3).render(true)
      },
      "open-display-4": {
        name: "open-display-4",
        title: "Open Display 4",
        icon: "fas fa-tv",
        button: true,
        onClick: () => new PlayerDisplay(4).render(true)
      }
    }
  };
});