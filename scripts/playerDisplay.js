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

  // test method: attaching listener to viewport after render
  async _render(...args) {
    await super._render(...args);

    const viewport = this.element.find("#simple-companion-viewport")[0];
    if (!viewport) {
      console.warn("Simple Companion | viewport not found");
      return;
    }

    viewport.onclick = (event) => {
      this.handleViewportClick(event, viewport);
    };

    console.log("Simple Companion | viewport click listener attached");
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

    for (let x = centerX - pixelsPerGrid / 2; x >= 0; x -= pixelsPerGrid) {
      grid += `<div style="position:absolute; left:${x}px; top:0; width:1px; height:360px; background:#333;"></div>`;
    }

    for (let x = centerX + pixelsPerGrid / 2; x < 360; x += pixelsPerGrid) {
      grid += `<div style="position:absolute; left:${x}px; top:0; width:1px; height:360px; background:#333;"></div>`;
    }

    for (let y = centerY - pixelsPerGrid / 2; y >= 0; y -= pixelsPerGrid) {
      grid += `<div style="position:absolute; left:0; top:${y}px; width:360px; height:1px; background:#333;"></div>`;
    }

    for (let y = centerY + pixelsPerGrid / 2; y < 360; y += pixelsPerGrid) {
      grid += `<div style="position:absolute; left:0; top:${y}px; width:360px; height:1px; background:#333;"></div>`;
    }

    let tokensHtml = "";

    tokensHtml += this.buildTokenHtml(centerX, centerY, 32, token);
    tokensHtml += this.buildLabelHtml(centerX, centerY, 32, token.name);

    for (const otherToken of canvas.tokens.placeables) {
      if (otherToken.id === token.id) continue;

      const otherCenterX = otherToken.x + gridSize / 2;
      const otherCenterY = otherToken.y + gridSize / 2;

      const dx = (otherCenterX - tokenCenterX) / gridSize;
      const dy = (otherCenterY - tokenCenterY) / gridSize;

      const screenX = centerX + dx * pixelsPerGrid;
      const screenY = centerY + dy * pixelsPerGrid;

      if (screenX < -50 || screenX > 410 || screenY < -50 || screenY > 410) continue;

      tokensHtml += this.buildTokenHtml(screenX, screenY, 28, otherToken);
      tokensHtml += this.buildLabelHtml(screenX, screenY, 28, otherToken.name);
    }

    return `
      <div style="margin-bottom:8px; font-size:13px; color:#aaa;">
        Local tactical viewport — 1 square = 5 ft
      </div>

      <div id="simple-companion-viewport" style="
        position: relative;
        width: 360px;
        height: 360px;
        background: #0a0a0a;
        border: 2px solid #777;
        overflow: hidden;
      ">
        ${grid}
        ${tokensHtml}
      </div>
    `;
  }

  buildLabelHtml(x, y, size, name) {
    return `
      <div style="
        position:absolute;
        left:${x}px;
        top:${y + size / 2 + 2}px;
        transform:translateX(-50%);
        font-size:10px;
        color:white;
        background:rgba(0,0,0,0.65);
        padding:2px 4px;
        border-radius:3px;
        z-index:20;
      ">
        ${name}
      </div>
    `;
  }

  buildTokenHtml(x, y, size, token) {
    const img = token.document.texture?.src;

    if (img) {
      return `
        <div style="
          position:absolute;
          left:${x - size / 2}px;
          top:${y - size / 2}px;
          width:${size}px;
          height:${size}px;
          border-radius:50%;
          border:2px solid white;
          overflow:hidden;
          background:#222;
        ">
          <img src="${img}" style="width:100%; height:100%; object-fit:cover;">
        </div>
      `;
    }

    const color = token.document.disposition < 0 ? "#ff5555" : "#55ff88";

    return `
      <div style="
        position:absolute;
        left:${x - size / 2}px;
        top:${y - size / 2}px;
        width:${size}px;
        height:${size}px;
        background:${color};
        border-radius:50%;
        border:2px solid white;
      "></div>
    `;
  }

  handleViewportClick(event, viewport) {
    const token = this.getToken();
    if (!token) return;

    const rect = viewport.getBoundingClientRect();

    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const centerX = 180;
    const centerY = 180;
    const pixelsPerGrid = 36;
    const gridSize = canvas.grid.size;

    const offsetGridX = Math.round((clickX - centerX) / pixelsPerGrid);
    const offsetGridY = Math.round((clickY - centerY) / pixelsPerGrid);

    console.log("Viewport click", { offsetGridX, offsetGridY });

    ui.notifications.info(`Selected: ${offsetGridX}, ${offsetGridY}`);
  }

  refresh() {
    this.render(false);
  }
}