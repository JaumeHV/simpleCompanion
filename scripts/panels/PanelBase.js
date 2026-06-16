export class PanelBase {
  static panelId = "";
  static panelLabel = "";
  static panelIcon = "fas fa-circle";
  static customIcon = "";

  constructor(display) {
    this.display = display;
  }

  async render(actor, containerEl) {
    containerEl.innerHTML = `<div class="panel-placeholder">
      <i class="${this.constructor.panelIcon}"></i>
      <h2>${this.constructor.panelLabel}</h2>
      <p>Placeholder — content coming soon</p>
    </div>`;
  }

  destroy() {
    this.display = null;
  }
}
