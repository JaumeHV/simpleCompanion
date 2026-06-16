const MODULE_ID = "simple-companion";

export function registerSettings() {
  for (let i = 1; i <= 4; i++) {
    game.settings.register(MODULE_ID, `player${i}ActorId`, {
      name: `Display ${i} — Actor ID`,
      hint: `Paste the Actor ID to assign to Display ${i}.`,
      scope: "world",
      config: true,
      type: String,
      default: ""
    });
  }
}

export function getActorId(displayIndex) {
  return game.settings.get(MODULE_ID, `player${displayIndex}ActorId`);
}
