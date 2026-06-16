import { registerSettings } from "./settings.js";
import { CompanionDisplay, activeDisplays } from "./app.js";

const MODULE_ID = "simple-companion";

function refreshAllDisplays() {
  for (const display of Object.values(activeDisplays)) {
    display.render(false);
  }
}

function refreshDisplaysForActor(actorId) {
  if (!actorId) return;
  for (let i = 1; i <= 4; i++) {
    const display = activeDisplays[i];
    if (!display) continue;
    const displayActorId = game.settings.get(MODULE_ID, `player${i}ActorId`);
    if (displayActorId === actorId) {
      display.render(false);
    }
  }
}

function openDisplay(displayIndex) {
  const existing = activeDisplays[displayIndex];
  if (existing) return existing.render(true);
  return new CompanionDisplay(displayIndex).render(true);
}

function buildDisplayTool(displayIndex) {
  return {
    name: `open-display-${displayIndex}`,
    title: `Open Display ${displayIndex}`,
    icon: "fas fa-tv",
    order: displayIndex,
    button: true,
    onChange: () => openDisplay(displayIndex)
  };
}

function buildDisplayTools() {
  return Object.fromEntries([1, 2, 3, 4].map((i) => {
    const tool = buildDisplayTool(i);
    return [tool.name, tool];
  }));
}

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | v2.0.0 initialising`);
  registerSettings();
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | v2.0.0 ready`);
  ui.notifications.info("Simple Companion v2.0.0 loaded.");
});

Hooks.on("updateActor", (actor) => {
  refreshDisplaysForActor(actor.id);
});

Hooks.on("getSceneControlButtons", (controls) => {
  const control = {
    name: "simple-companion",
    title: "Simple Companion",
    icon: "fas fa-tablet-alt",
    layer: "tokens",
    order: 99,
    tools: buildDisplayTools()
  };
  if (Array.isArray(controls)) {
    controls.push(control);
  } else {
    controls["simple-companion"] = control;
  }
});
