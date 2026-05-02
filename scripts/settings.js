const MODULE_ID = "simple-companion";

export function registerSettings() {
  for (let i = 1; i <= 4; i++) {
    game.settings.register(MODULE_ID, `player${i}ActorId`, {
      name: `Display ${i} Actor ID`,
      hint: `Actor ID assigned to Display ${i}.`,
      scope: "world",
      config: true,
      type: String,
      default: ""
    });
  }

  game.settings.register(MODULE_ID, "debugMode", {
    name: "Debug Mode",
    hint: "Enable extra console logging for development.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}