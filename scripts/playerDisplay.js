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
      width: 500,
      height: 500,
      resizable: true,
      title: "Player Display"
    });
  }

  getActor() {
    const actorId = game.settings.get(MODULE_ID, `player${this.displayIndex}ActorId`);
    return game.actors.get(actorId);
  }

  getToken() {
    const actor = this.getActor();
    if (!actor) return null;

    const tokens = actor.getActiveTokens();
    return tokens.length ? tokens[0] : null;
  }

  async getData() {
    const actor = this.getActor();

    if (!actor) return { name: "No Actor Assigned", hp: "-" };

    const hp = actor.system.attributes.hp;

    return {
      name: actor.name,
      hp: `${hp.value} / ${hp.max}`
    };
  }

  buildViewportHtml() {
    const token = this.getToken();
    if (!token) return `<p>No token on current scene</p>`;

    const centerX = 180;
    const centerY = 180;
    const pixelsPerGrid = 36;
    const gridSize = canvas.grid.size;

    let dots = "";

    dots += this.buildDotHtml(centerX, centerY, 24, "#44d9ff", token.name);

    for (const otherToken of canvas.tokens.placeables) {
      if (otherToken.id === token.id) continue;

      const dx = (otherToken.x - token.x) / gridSize;
      const dy = (otherToken.y - token.y) / gridSize;

      const screenX = centerX + dx * pixelsPerGrid;
      const screenY = centerY + dy * pixelsPerGrid;

      if (screenX < -50 || screenX > 410 || screenY < -50 || screenY > 410) continue;

      const color = otherToken.document.disposition < 0 ? "#ff5555" : "#55ff88";
      dots += this.buildDotHtml(screenX, screenY, 18, color, otherToken.name);
    }

    return `
      <div id="simple-companion-viewport" style="
        position: relative;
        width: 360px;
        height: 360px;
        background: #111;
        border: 2px solid #555;
        overflow: hidden;
      ">
        ${dots}
      </div>
    `;
  }

  buildDotHtml(x, y, size, color, label) {
    return `
      <div title="${label}" style="
        position: absolute;
        left: ${x - size / 2}px;
        top: ${y - size / 2}px;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border-radius: 50%;
        border: 2px solid white;
        z-index: 10;
      "></div>
    `;
  }

  async _renderInner() {
    const data = await this.getData();

    return `
      <div style="padding:20px; font-size:16px;">
        <h2>Display ${this.displayIndex}: ${data.name}</h2>
        <p>HP: ${data.hp}</p>
        ${this.buildViewportHtml()}
      </div>
    `;
  }

  refresh() {
    this.render(false);
  }
}