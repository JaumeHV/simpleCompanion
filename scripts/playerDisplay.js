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
    this.gridCanvas = null;
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

  createGridCanvas() {
    const canvas = document.createElement("canvas");
    canvas.width = VIEWPORT_SIZE;
    canvas.height = VIEWPORT_SIZE;
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.zIndex = "1";

    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;

    const centerX = VIEWPORT_SIZE / 2;
    const centerY = VIEWPORT_SIZE / 2;

    // Draw vertical lines
    for (let x = centerX - GRID_PIXELS / 2; x >= 0; x -= GRID_PIXELS) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VIEWPORT_SIZE);
      ctx.stroke();
    }

    for (let x = centerX + GRID_PIXELS / 2; x < VIEWPORT_SIZE; x += GRID_PIXELS) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VIEWPORT_SIZE);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = centerY - GRID_PIXELS / 2; y >= 0; y -= GRID_PIXELS) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VIEWPORT_SIZE, y);
      ctx.stroke();
    }

    for (let y = centerY + GRID_PIXELS / 2; y < VIEWPORT_SIZE; y += GRID_PIXELS) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VIEWPORT_SIZE, y);
      ctx.stroke();
    }

    return canvas;
  }

  buildViewportHtml() {
    const token = this.getToken();
    if (!token) return `<p>No token on current scene</p>`;

    const centerX = VIEWPORT_SIZE / 2;
    const centerY = VIEWPORT_SIZE / 2;
    const gridSize = canvas.grid.size;

    const tokenCenterX = token.x + gridSize / 2;
    const tokenCenterY = token.y + gridSize / 2;

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
      " data-viewport="true">
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

    const html = await renderTemplate("templates/hud/container.html", {
      content: `
        <div style="padding:20px; font-size:16px;">
          <h2>Display ${this.displayIndex}: ${data.name}</h2>
          <p>HP: ${data.hp}</p>
          ${this.buildViewportHtml()}
        </div>
      `
    }).catch(() => {
      // Fallback if template system fails
      return `
        <div style="padding:20px; font-size:16px;">
          <h2>Display ${this.displayIndex}: ${data.name}</h2>
          <p>HP: ${data.hp}</p>
          ${this.buildViewportHtml()}
        </div>
      `;
    });

    return html;
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    // Inject grid canvas after render
    const viewport = html.find("[data-viewport='true']");
    if (viewport.length && !this.gridCanvas) {
      this.gridCanvas = this.createGridCanvas();
      viewport[0].insertBefore(this.gridCanvas, viewport[0].firstChild);
    }
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
    this.gridCanvas = null;
    delete activeDisplays[this.displayIndex];
    return super.close();
  }
}