const MODULE_ID = "simple-companion";

export const activeDisplays = {};

export class PlayerDisplay extends Application {
  constructor(displayIndex, options = {}) {
  super(options);
  this.displayIndex = displayIndex;
  activeDisplays[displayIndex] = this;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "simple-companion-display",
      template: null,
      popOut: true,
      width: 400,
      height: 300,
      resizable: true,
      title: "Player Display"
    });
  }

  getActor() {
    const actorId = game.settings.get(MODULE_ID, `player${this.displayIndex}ActorId`);
    return game.actors.get(actorId);
  }

  async getData() {
    const actor = this.getActor();

    if (!actor) {
      return {
        name: "No Actor Assigned",
        hp: "-"
      };
    }

    const hp = actor.system.attributes.hp;

    return {
      name: actor.name,
      hp: `${hp.value} / ${hp.max}`
    };
  }

  async _renderInner() {
    const data = await this.getData();

    return `
      <div style="padding:20px; font-size:20px;">
        <h2>Display ${this.displayIndex}</h2>
        <p><strong>${data.name}</strong></p>
        <p>HP: ${data.hp}</p>
      </div>
    `;
  }

  refresh() {
    this.render(false);
  }
}