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

  buildViewportHtml() {
    const token = this.getToken();
    if (!token) return `<p>No token on current scene</p>`;

    const centerX = 180;
    const centerY = 180;
    const pixelsPerGrid = 36;
    const gridSize = canvas.grid.size;

    const tokenCenterX = token.x + gridSize / 2;
    const tokenCenterY = token.y + gridSize / 2;

    let grid = "";

    for (let x = centerX % pixelsPerGrid; x < 360; x += pixelsPerGrid) {
      grid += `
        <div style="
          position:absolute;
          left:${x}px;
          top:0;
          width:1px;
          height:360px;
          background:#333;
        "></div>
      `;
    }

    for (let y = centerY % pixelsPerGrid; y < 360; y += pixelsPerGrid) {
      grid += `
        <div style="
          position:absolute;
          left:0;
          top:${y}px;
          width:360px;
          height:1px;
          background:#333;
        "></div>
      `;
    }

    let dots = "";

    dots += this.buildDotHtml(centerX, centerY, 24, "#44d9ff", token.name);

    for (const otherToken of canvas.tokens.placeables) {
      if (otherToken.id === token.id) continue;

      const otherCenterX = otherToken.x + gridSize / 2;
      const otherCenterY = otherToken.y + gridSize / 2;

      const dx = (otherCenterX - tokenCenterX) / gridSize;
      const dy = (otherCenterY - tokenCenterY) / gridSize;

      const screenX = centerX + dx * pixelsPerGrid;
      const screenY = centerY + dy * pixelsPerGrid;

      if (screenX < -50 || screenX > 410 || screenY < -50 || screenY > 410) continue;

      const color = otherToken.document.disposition < 0 ? "#ff5555" : "#55ff88";
      dots += this.buildDotHtml(screenX, screenY, 18, color, otherToken.name);
    }

    return `
      <div style="margin-bottom:8px; font-size:13px; color:#aaa;">
        Local tactical viewport — 1 square = 5 ft
      </div>

      <div id="simple-companion-viewport" style="
        position: relative;
        width: 360px;
        height: 360px;
        background: #111;
        border: 2px solid #555;
        overflow: hidden;
      ">
        ${grid}
        ${dots}

        <div style="
          position:absolute;
          left:10px;
          bottom:10px;
          font-size:12px;
          color:#aaa;
          background:rgba(0,0,0,0.6);
          padding:3px 6px;
          border-radius:4px;
        ">
          5 ft
        </div>
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