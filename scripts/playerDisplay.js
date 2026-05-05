const MODULE_ID = "simple-companion";

// Viewport constants
const VIEWPORT_SIZE = 360;
const GRID_PIXELS = 36;
const GRID_COLOR = "#333";
const TOKEN_SIZE_PLAYER = 32;
const TOKEN_SIZE_OTHER = 28;

export const activeDisplays = {};

export class PlayerDisplay extends Application {
  constructor(displayIndex, options = {}) {
    super(options);
    this.displayIndex = displayIndex;
    this.lastRefreshTime = 0;
    this.refreshDebounceDelay = 50; // ms
    this.pendingRefresh = null;
    activeDisplays[displayIndex] = this;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "simple-companion-display",
      template: null,
      popOut: true,
      width: 1280,
      height: 800,
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

  buildGridHtml() {
    let grid = "";
    const centerX = VIEWPORT_SIZE / 2;
    const centerY = VIEWPORT_SIZE / 2;

    // Vertical lines
    for (let x = centerX - GRID_PIXELS / 2; x >= 0; x -= GRID_PIXELS) {
      grid += `<div style="position:absolute;left:${x}px;top:0;width:1px;height:${VIEWPORT_SIZE}px;background:${GRID_COLOR};z-index:1;"></div>`;
    }

    for (let x = centerX + GRID_PIXELS / 2; x < VIEWPORT_SIZE; x += GRID_PIXELS) {
      grid += `<div style="position:absolute;left:${x}px;top:0;width:1px;height:${VIEWPORT_SIZE}px;background:${GRID_COLOR};z-index:1;"></div>`;
    }

    // Horizontal lines
    for (let y = centerY - GRID_PIXELS / 2; y >= 0; y -= GRID_PIXELS) {
      grid += `<div style="position:absolute;left:0;top:${y}px;width:${VIEWPORT_SIZE}px;height:1px;background:${GRID_COLOR};z-index:1;"></div>`;
    }

    for (let y = centerY + GRID_PIXELS / 2; y < VIEWPORT_SIZE; y += GRID_PIXELS) {
      grid += `<div style="position:absolute;left:0;top:${y}px;width:${VIEWPORT_SIZE}px;height:1px;background:${GRID_COLOR};z-index:1;"></div>`;
    }

    return grid;
  }

  buildViewportHtml() {
    const token = this.getToken();
    if (!token) return `<p>No token on current scene</p>`;

    const centerX = VIEWPORT_SIZE / 2;
    const centerY = VIEWPORT_SIZE / 2;
    const gridSize = canvas.grid.size;

    const tokenCenterX = token.x + gridSize / 2;
    const tokenCenterY = token.y + gridSize / 2;

    const grid = this.buildGridHtml();
    let tokensHtml = "";

    // Player token
    tokensHtml += this.buildTokenHtml(centerX, centerY, TOKEN_SIZE_PLAYER, token);
    tokensHtml += this.buildLabelHtml(centerX, centerY, TOKEN_SIZE_PLAYER, token.name);

    // Other tokens
    for (const otherToken of canvas.tokens.placeables) {
      if (otherToken.id === token.id) continue;

      const otherCenterX = otherToken.x + gridSize / 2;
      const otherCenterY = otherToken.y + gridSize / 2;

      const dx = (otherCenterX - tokenCenterX) / gridSize;
      const dy = (otherCenterY - tokenCenterY) / gridSize;

      const screenX = centerX + dx * GRID_PIXELS;
      const screenY = centerY + dy * GRID_PIXELS;

      if (screenX < -50 || screenX > VIEWPORT_SIZE + 50 || screenY < -50 || screenY > VIEWPORT_SIZE + 50) continue;

      tokensHtml += this.buildTokenHtml(screenX, screenY, TOKEN_SIZE_OTHER, otherToken);
      tokensHtml += this.buildLabelHtml(screenX, screenY, TOKEN_SIZE_OTHER, otherToken.name);
    }

    return `
      <div style="margin-bottom:8px; font-size:13px; color:#aaa;">
        Local tactical viewport — 1 square = 5 ft
      </div>

      <div id="simple-companion-viewport" style="
        position: relative;
        width: ${VIEWPORT_SIZE}px;
        height: ${VIEWPORT_SIZE}px;
        background: #0a0a0a;
        border: 2px solid #777;
        overflow: hidden;
      ">
        ${grid}
        ${tokensHtml}

        <div style="
          position:absolute;
          left:10px;
          bottom:10px;
          font-size:12px;
          color:#aaa;
          background:rgba(0,0,0,0.6);
          padding:3px 6px;
          border-radius:4px;
          z-index: 30;
        ">
          5 ft
        </div>
      </div>
    `;
  }

  buildLabelHtml(x, y, size, name) {
    return `
      <div style="
        position: absolute;
        left: ${x}px;
        top: ${y + size / 2 + 2}px;
        transform: translateX(-50%);
        font-size: 10px;
        color: white;
        background: rgba(0,0,0,0.65);
        padding: 2px 4px;
        border-radius: 3px;
        white-space: nowrap;
        pointer-events: none;
        z-index: 20;
      ">
        ${name}
      </div>
    `;
  }

  buildTokenHtml(x, y, size, token) {
    const img = token.document.texture?.src;

    if (img) {
      return `
        <div title="${token.name}" style="
          position: absolute;
          left: ${x - size / 2}px;
          top: ${y - size / 2}px;
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          border: 2px solid white;
          overflow: hidden;
          z-index: 10;
          background: #222;
        ">
          <img src="${img}" style="
            width: 100%;
            height: 100%;
            object-fit: cover;
          ">
        </div>
      `;
    }

    const color = token.document.disposition < 0 ? "#ff5555" : "#55ff88";

    return `
      <div title="${token.name}" style="
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
    const now = Date.now();
    
    // Debounce refresh calls
    if (this.pendingRefresh) {
      clearTimeout(this.pendingRefresh);
    }

    const timeSinceLastRefresh = now - this.lastRefreshTime;
    
    if (timeSinceLastRefresh < this.refreshDebounceDelay) {
      // Schedule refresh after debounce delay
      this.pendingRefresh = setTimeout(() => {
        this.lastRefreshTime = Date.now();
        this.render(false);
        this.pendingRefresh = null;
      }, this.refreshDebounceDelay - timeSinceLastRefresh);
    } else {
      // Refresh immediately
      this.lastRefreshTime = now;
      this.render(false);
    }
  }

  close() {
    if (this.pendingRefresh) {
      clearTimeout(this.pendingRefresh);
    }
    delete activeDisplays[this.displayIndex];
    return super.close();
  }
}