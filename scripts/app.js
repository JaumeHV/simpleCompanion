import { InventoryPanel } from "./panels/InventoryPanel.js";
import { ChatPanel } from "./panels/ChatPanel.js";
import { SpellsPanel } from "./panels/SpellsPanel.js";
import { TacMapPanel } from "./panels/TacMapPanel.js";
import { TradePanel } from "./panels/TradePanel.js";
import { Panel6 } from "./panels/Panel6.js";
import { getActorId } from "./settings.js";

const MODULE_ID = "simple-companion";

const PANEL_REGISTRY = {
  inventory: InventoryPanel,
  chat: ChatPanel,
  spells: SpellsPanel,
  tacmap: TacMapPanel,
  trade: TradePanel,
  panel6: Panel6
};

const NAV_BUTTONS = [
  { id: "inventory", label: "Inv", icon: "fas fa-box" },
  { id: "chat", label: "Chat", icon: "fas fa-comment-dots" },
  { id: "spells", label: "Spells", icon: "fas fa-hat-wizard" },
  { id: "tacmap", label: "TacMap", icon: "fas fa-map-marked-alt" },
  { id: "trade", label: "Trade", icon: "fas fa-handshake" },
  { id: "panel6", label: "6", icon: "fas fa-ellipsis-h" }
];

export const activeDisplays = {};

export class CompanionDisplay extends foundry.applications.api.ApplicationV2 {
  constructor(displayIndex, options = {}) {
    super({
      id: `simple-companion-display-${displayIndex}`,
      window: { title: `Simple Companion ${displayIndex}` },
      ...options
    });
    this.displayIndex = displayIndex;
    this.activePanel = "inventory";
    this._activePanelInstance = null;
    activeDisplays[displayIndex] = this;
  }

  static DEFAULT_OPTIONS = {
    id: "simple-companion-display",
    window: {
      icon: "fas fa-tv",
      frame: true,
      resizable: true
    },
    position: {
      width: 1280,
      height: 800
    }
  };

  getActor() {
    const actorId = getActorId(this.displayIndex);
    if (!actorId) return null;
    return game.actors.get(actorId) ?? null;
  }

  _prepareContext() {
    const actor = this.getActor();
    const portrait = actor?.img ?? "icons/svg/mystery-man.svg";
    const actorName = actor?.name ?? "No Actor Assigned";

    const navButtons = NAV_BUTTONS.map((btn) => ({
      ...btn,
      isActive: btn.id === this.activePanel
    }));

    return {
      displayIndex: this.displayIndex,
      activePanel: this.activePanel,
      navButtons,
      portrait,
      actorName,
      hasActor: !!actor
    };
  }

  _renderHTML(context) {
    const { displayIndex, navButtons, portrait, actorName, hasActor } = context;

    const navHtml = navButtons.map((btn) => `
      <button class="companion-nav-btn${btn.isActive ? " active" : ""}" data-panel="${btn.id}">
        <i class="${btn.icon}"></i>
        <span>${btn.label}</span>
      </button>
    `).join("");

    return `
      <div class="companion-shell" data-display="${displayIndex}">
        <div class="companion-main">
          <div class="companion-portrait">
            <img src="${portrait}" alt="${actorName}" title="${actorName}" />
          </div>
          <div class="companion-panel-content" id="companion-panel-content-${displayIndex}">
            ${hasActor ? "" : '<div class="panel-placeholder"><i class="fas fa-user-slash"></i><h2>No Actor Assigned</h2><p>Set an Actor ID in module settings.</p></div>'}
          </div>
        </div>
        <nav class="companion-nav">
          ${navHtml}
        </nav>
      </div>
    `;
  }

  _onRender(context, options) {
    const contentEl = this.element?.querySelector?.(`#companion-panel-content-${this.displayIndex}`);
    if (contentEl && context.hasActor) {
      this._renderActivePanel(contentEl);
    }
  }

  _activateListeners(htmlElement) {
    const nav = htmlElement.querySelector(".companion-nav");
    if (!nav) return;

    nav.addEventListener("click", (event) => {
      const btn = event.target.closest(".companion-nav-btn");
      if (!btn) return;
      const panelId = btn.dataset.panel;
      if (panelId && panelId !== this.activePanel) {
        this.setPanel(panelId);
      }
    });
  }

  setPanel(panelId) {
    if (!PANEL_REGISTRY[panelId]) return;
    this.activePanel = panelId;
    this.render(false);
  }

  async _renderActivePanel(containerEl) {
    if (this._activePanelInstance) {
      this._activePanelInstance.destroy();
      this._activePanelInstance = null;
    }

    const actor = this.getActor();
    if (!actor) return;

    const PanelClass = PANEL_REGISTRY[this.activePanel];
    if (!PanelClass) return;

    this._activePanelInstance = new PanelClass(this);
    await this._activePanelInstance.render(actor, containerEl);
  }

  async close(options) {
    if (this._activePanelInstance) {
      this._activePanelInstance.destroy();
      this._activePanelInstance = null;
    }
    delete activeDisplays[this.displayIndex];
    return super.close(options);
  }
}
