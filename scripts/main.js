import { registerSettings } from "./settings.js";
import { PlayerDisplay, activeDisplays } from "./playerDisplay.js";

const MODULE_ID = "simple-companion";

function isDebugMode() {
  return game.settings.get(MODULE_ID, "debugMode");
}

function refreshAllDisplays() {
  for (const display of Object.values(activeDisplays)) {
    display.refresh();
  }
}

function refreshDisplaysForActor(actorId) {
  if (!actorId) return;

  for (let i = 1; i <= 4; i++) {
    const display = activeDisplays[i];
    if (!display) continue;

    const displayActorId = game.settings.get(MODULE_ID, `player${i}ActorId`);
    if (displayActorId === actorId) {
      display.refresh();
    }
  }
}

function openDisplay(displayIndex) {
  const existingDisplay = activeDisplays[displayIndex];
  if (existingDisplay) return existingDisplay.render(true);

  return new PlayerDisplay(displayIndex).render(true);
}

function buildDisplayTool(displayIndex) {
  return {
    name: `open-display-${displayIndex}`,
    title: `Open Display ${displayIndex}`,
    icon: "fas fa-tv",
    order: displayIndex,
    button: true,
    onChange: () => openDisplay(displayIndex),
    onClick: () => openDisplay(displayIndex)
  };
}

function buildDisplayTools() {
  return Object.fromEntries([1, 2, 3, 4].map((displayIndex) => {
    const tool = buildDisplayTool(displayIndex);
    return [tool.name, tool];
  }));
}

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initialising`);
  registerSettings();
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Ready`);
  ui.notifications.info("Simple Companion loaded.");

  Hooks.on("updateActor", (actor) => {
    refreshDisplaysForActor(actor.id);
  });
});

Hooks.on("updateToken", (tokenDoc, changes) => {
  if (isDebugMode()) {
    console.log("Token document updated", tokenDoc.name, changes);
  }

  refreshAllDisplays();
});

Hooks.on("updateDocument", (document) => {
  if (document.documentName === "Token") {
    refreshAllDisplays();
  }
});

Hooks.on("moveToken", () => {
  refreshAllDisplays();
});

Hooks.on("recordToken", () => {
  refreshAllDisplays();
});

Hooks.on("pauseToken", () => {
  refreshAllDisplays();
});

Hooks.on("stopToken", () => {
  refreshAllDisplays();
});

Hooks.on("refreshToken", (token) => {
  refreshAllDisplays();
});

Hooks.on("createChatMessage", () => {
  refreshAllDisplays();
});

Hooks.on("updateChatMessage", () => {
  refreshAllDisplays();
});

Hooks.on("deleteChatMessage", () => {
  refreshAllDisplays();
});

Hooks.on("createCombat", () => {
  refreshAllDisplays();
});

Hooks.on("updateCombat", () => {
  refreshAllDisplays();
});

Hooks.on("deleteCombat", () => {
  refreshAllDisplays();
});

Hooks.on("createCombatant", () => {
  refreshAllDisplays();
});

Hooks.on("updateCombatant", () => {
  refreshAllDisplays();
});

Hooks.on("deleteCombatant", () => {
  refreshAllDisplays();
});

Hooks.on("getSceneControlButtons", (controls) => {
  const simpleCompanionControl = {
    name: "simple-companion",
    title: "Simple Companion",
    icon: "fas fa-tablet-alt",
    layer: "tokens",
    order: 99,
    activeTool: "open-display-1",
    tools: buildDisplayTools()
  };

  if (Array.isArray(controls)) {
    controls.push(simpleCompanionControl);
  } else {
    controls["simple-companion"] = simpleCompanionControl;
  }
});
