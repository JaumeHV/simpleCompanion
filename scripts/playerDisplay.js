const MODULE_ID = "simple-companion";

// Viewport constants
const VIEWPORT_SIZE = 720;
const GRID_PIXELS = 72;
const GRID_COLOR = "#333";
const TOKEN_SIZE_PLAYER = 64;
const TOKEN_SIZE_OTHER = 56;
const PANEL_CHAT_MESSAGE_LIMIT = 20;

export const activeDisplays = {};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[character]));
}

function collectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (Array.isArray(collection.contents)) return collection.contents;
  if (typeof collection.values === "function") return Array.from(collection.values());
  return Array.from(collection);
}

export class PlayerDisplay extends Application {
  constructor(displayIndex, options = {}) {
    super(options);
    this.displayIndex = displayIndex;
    this.lastRefreshTime = 0;
    this.refreshDebounceDelay = 50; // ms
    this.pendingRefresh = null;
    this.activePanel = "combat";
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

  get id() {
    return `simple-companion-display-${this.displayIndex}`;
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

      <div style="
        position: relative;
        width: ${VIEWPORT_SIZE}px;
        height: ${VIEWPORT_SIZE}px;
        max-width: 100%;
        background: #0a0a0a;
        border: 2px solid #777;
        overflow: hidden;
      " id="simple-companion-viewport-${this.displayIndex}">
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
    const safeName = escapeHtml(name);

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
        ${safeName}
      </div>
    `;
  }

  buildTokenHtml(x, y, size, token) {
    const img = escapeHtml(token.document.texture?.src);
    const tokenName = escapeHtml(token.name);

    if (img) {
      return `
        <div title="${tokenName}" style="
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
      <div title="${tokenName}" style="
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

  buildPanelButton(panel, iconClass, label) {
    const isActive = this.activePanel === panel;

    return `
      <button type="button" data-companion-panel="${panel}" title="${escapeHtml(label)}" style="
        flex: 1 1 50%;
        height: 44px;
        border: 0;
        border-right: ${panel === "combat" ? "1px solid #555" : "0"};
        background: ${isActive ? "#3d4656" : "#20242d"};
        color: ${isActive ? "#ffffff" : "#b8c0cf"};
        font-size: 18px;
        cursor: pointer;
      ">
        <i class="${iconClass}"></i>
      </button>
    `;
  }

  buildCombatPanelHtml() {
    const combats = collectionValues(game.combats);
    if (!combats.length) {
      return `<div style="padding:14px; color:#aaa;">No combat encounters.</div>`;
    }

    return combats.map((combat) => {
      const isCurrent = game.combat?.id === combat.id;
      const sceneName = escapeHtml(combat.scene?.name ?? "Unknown Scene");
      const round = escapeHtml(combat.round ?? "-");
      const turn = escapeHtml((combat.turn ?? 0) + 1);
      const activeCombatantId = isCurrent ? combat.combatant?.id : null;
      const combatants = collectionValues(combat.turns ?? combat.combatants);

      const combatantsHtml = combatants.map((combatant) => {
        const isTurn = activeCombatantId && combatant.id === activeCombatantId;
        const name = escapeHtml(combatant.name);
        const initiative = combatant.initiative ?? "-";

        return `
          <div style="
            display:flex;
            align-items:center;
            gap:8px;
            padding:8px 10px;
            background:${isTurn ? "rgba(190, 130, 45, 0.28)" : "rgba(255,255,255,0.04)"};
            border-bottom:1px solid rgba(255,255,255,0.07);
          ">
            <div style="width:28px; color:#c4cad5; text-align:right;">${escapeHtml(initiative)}</div>
            <div style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${name}</div>
          </div>
        `;
      }).join("");

      return `
        <section style="border-bottom:1px solid #3a3f49;">
          <div style="padding:10px 12px; background:#181b22;">
            <div style="display:flex; justify-content:space-between; gap:8px; color:#fff;">
              <strong style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sceneName}</strong>
              <span style="color:#c4cad5;">R${round} T${turn}</span>
            </div>
          </div>
          ${combatantsHtml || `<div style="padding:10px 12px; color:#aaa;">No combatants.</div>`}
        </section>
      `;
    }).join("");
  }

  buildChatPanelHtml() {
    const messages = collectionValues(game.messages).slice(-PANEL_CHAT_MESSAGE_LIMIT).reverse();
    if (!messages.length) {
      return `<div style="padding:14px; color:#aaa;">No chat messages.</div>`;
    }

    return messages.map((message) => {
      const speaker = escapeHtml(message.speaker?.alias ?? message.user?.name ?? "Unknown");
      const content = escapeHtml(String(message.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());

      return `
        <article style="
          padding:10px 12px;
          border-bottom:1px solid rgba(255,255,255,0.08);
          background:rgba(255,255,255,0.03);
        ">
          <div style="font-weight:700; color:#fff; margin-bottom:4px;">${speaker}</div>
          <div style="color:#d8dde8; line-height:1.35;">${content || "&nbsp;"}</div>
        </article>
      `;
    }).join("");
  }

  buildSidePanelHtml() {
    const panelHtml = this.activePanel === "chat" ? this.buildChatPanelHtml() : this.buildCombatPanelHtml();

    return `
      <aside style="
        width: 420px;
        min-width: 320px;
        max-width: 42%;
        height: 720px;
        border: 2px solid #555;
        background:#101218;
        color:#e5e8ef;
        display:flex;
        flex-direction:column;
        overflow:hidden;
      ">
        <div style="
          height:44px;
          display:flex;
          border-bottom:1px solid #555;
          background:#20242d;
        ">
          ${this.buildPanelButton("combat", "fas fa-swords", "Combat Encounters")}
          ${this.buildPanelButton("chat", "fas fa-comments", "Chat Messages")}
        </div>
        <div style="flex:1; overflow:auto;">
          ${panelHtml}
        </div>
      </aside>
    `;
  }

  async _renderInner() {
    const data = await this.getData();
    const safeName = escapeHtml(data.name);
    const safeHp = escapeHtml(data.hp);

    return `
      <div style="padding:20px; font-size:16px;">
        <h2>Display ${this.displayIndex}: ${safeName}</h2>
        <p>HP: ${safeHp}</p>
        <div style="
          display:flex;
          gap:16px;
          align-items:flex-start;
          width:100%;
          overflow:hidden;
        ">
          <main style="flex:1 1 auto; min-width:0;">
            ${this.buildViewportHtml()}
          </main>
          ${this.buildSidePanelHtml()}
        </div>
      </div>
    `;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find("[data-companion-panel]").on("click", (event) => {
      this.activePanel = event.currentTarget.dataset.companionPanel;
      this.render(false);
    });
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

  close(options) {
    if (this.pendingRefresh) {
      clearTimeout(this.pendingRefresh);
    }
    delete activeDisplays[this.displayIndex];
    return super.close(options);
  }
}
