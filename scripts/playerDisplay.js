const MODULE_ID = "simple-companion";

// Viewport constants
const VIEWPORT_SIZE = 720;
const GRID_PIXELS = 72;
const HALF_GRID_PIXELS = GRID_PIXELS / 2;
const GRID_COLOR = "#333";
const TOKEN_FOOTPRINT_PADDING = 4;
const SIDE_PANEL_WIDTH = 420;
const SIDE_PANEL_HEIGHT = 720;
const TEMPLATE_CAPTURE_INTERVAL = 100;
const TEMPLATE_HIGHLIGHT_COLOR = "rgba(106,168,255,0.34)";
const TEMPLATE_HIGHLIGHT_BORDER = "rgba(148,197,255,0.72)";
const TEMPLATE_PREVIEW_COLOR = "#6aa8ff";
const ACTIVE_TEMPLATE_FILL = "rgba(86, 142, 255, 0.18)";
const ACTIVE_TEMPLATE_BORDER = "rgba(123, 174, 255, 0.72)";
const VIEWPORT_ZOOM_MIN = 0.6;
const VIEWPORT_ZOOM_MAX = 1.8;
const TOKEN_RING_COLORS = {
  hostile: "#9e3834",
  friendly: "#317a33",
  neutral: "#818386"
};
const BLOCKED_TEMPLATE_PLACEMENT_EVENTS = ["pointerdown", "pointerup", "mousedown", "mouseup", "click"];
const BLOCKED_TEMPLATE_LAYER_METHODS = [
  "_onClickLeft",
  "_onDragLeftStart",
  "_onDragLeftMove",
  "_onDragLeftDrop",
  "_onUnclickLeft"
];
const BLOCKED_TEMPLATE_PREVIEW_METHODS = [
  "_onClickLeft",
  "_onDragLeftStart",
  "_onDragLeftMove",
  "_onDragLeftDrop",
  "_onUnclickLeft"
];

export const activeDisplays = {};

let canvasTemplatePlacementGuardInstalled = false;
let measuredTemplatePreviewGuardInstalled = false;
let suppressNextMainTemplateInteraction = false;
let suppressMainTemplatePlacementUntil = 0;
let suppressMainTemplatePlacementClearTimer = null;
let suppressedTemplateLayerClicksRemaining = 0;
let suppressedMeasuredTemplateCreatesRemaining = 0;
const patchedTemplateLayers = new WeakSet();

export function suppressNextMeasuredTemplateCreates(count = 1) {
  suppressedMeasuredTemplateCreatesRemaining = Math.max(
    suppressedMeasuredTemplateCreatesRemaining,
    Math.max(Number(count) || 0, 0)
  );
}

export function consumeSuppressedMeasuredTemplateCreate() {
  if (suppressedMeasuredTemplateCreatesRemaining <= 0) return false;
  suppressedMeasuredTemplateCreatesRemaining -= 1;
  return true;
}

function shouldSuppressMainTemplatePlacement() {
  if (suppressNextMainTemplateInteraction && Date.now() >= suppressMainTemplatePlacementUntil) {
    suppressNextMainTemplateInteraction = false;
  }

  return suppressNextMainTemplateInteraction;
}

function suppressMainTemplatePlacementFor(durationMs = 1500) {
  suppressNextMainTemplateInteraction = true;
  suppressMainTemplatePlacementUntil = Date.now() + durationMs;

  if (suppressMainTemplatePlacementClearTimer) {
    clearTimeout(suppressMainTemplatePlacementClearTimer);
    suppressMainTemplatePlacementClearTimer = null;
  }
}

function scheduleMainTemplateSuppressionClear() {
  if (suppressMainTemplatePlacementClearTimer) return;

  suppressMainTemplatePlacementClearTimer = setTimeout(() => {
    suppressNextMainTemplateInteraction = false;
    suppressMainTemplatePlacementClearTimer = null;
  }, 0);
}

function suppressNextTemplateLayerClicks(count = 1) {
  suppressedTemplateLayerClicksRemaining = Math.max(
    suppressedTemplateLayerClicksRemaining,
    Math.max(Number(count) || 0, 0)
  );
}

function consumeSuppressedTemplateEvent(event) {
  if (!event) return;
  event.preventDefault?.();
  event.stopPropagation?.();
  event.stopImmediatePropagation?.();

  if (event.type === "click") scheduleMainTemplateSuppressionClear();
}

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

function getSceneNameForCombat(combat) {
  return combat.scene?.name
    ?? game.scenes?.get(combat.sceneId)?.name
    ?? "Unknown Scene";
}

function getHtmlElement(html) {
  return html?.[0] ?? html;
}

function isTokenHidden(token) {
  return Boolean(token.document?.hidden ?? token.hidden);
}

function getTokenRingColor(token) {
  const disposition = token.document?.disposition ?? token.disposition;
  if (disposition < 0) return TOKEN_RING_COLORS.hostile;
  if (disposition > 0) return TOKEN_RING_COLORS.friendly;
  return TOKEN_RING_COLORS.neutral;
}

function getTokenFootprint(token, gridPixels = GRID_PIXELS) {
  const width = Number(token.document?.width ?? 1);
  const height = Number(token.document?.height ?? 1);

  return {
    width: Math.max(width, 0.25) * gridPixels,
    height: Math.max(height, 0.25) * gridPixels
  };
}

function getTokenCanvasCenter(token, gridSize) {
  const width = Math.max(Number(token.document?.width ?? 1), 0.25);
  const height = Math.max(Number(token.document?.height ?? 1), 0.25);

  return {
    x: token.x + (width * gridSize) / 2,
    y: token.y + (height * gridSize) / 2
  };
}

function getActiveTemplatePreview() {
  const previewChildren = Array.from(canvas.templates?.preview?.children ?? []);
  const previewCandidates = [
    ...previewChildren,
    canvas.templates?._preview,
    canvas.templates?.hover
  ].filter(Boolean);

  return previewCandidates.find((child) => {
    const documentName = child.document?.documentName ?? child.document?.constructor?.documentName;
    return child.isPreview !== false && documentName === "MeasuredTemplate";
  }) ?? null;
}

function getSceneGridDistance() {
  return Number(canvas.scene?.grid?.distance ?? canvas.grid?.distance ?? 5) || 5;
}

function templateDistanceToViewportPixels(distance, gridPixels = GRID_PIXELS) {
  return (Number(distance ?? 0) / getSceneGridDistance()) * gridPixels;
}

function getSceneHalfGridSize() {
  return canvas.grid.size / 2;
}

function snapToIncrement(value, increment) {
  return Math.round(value / increment) * increment;
}

function snapViewportPointToHalfGrid(point, halfGridPixels = HALF_GRID_PIXELS) {
  return {
    x: snapToIncrement(point.x, halfGridPixels),
    y: snapToIncrement(point.y, halfGridPixels)
  };
}

function snapScenePointToHalfGrid(point) {
  const halfGridSize = getSceneHalfGridSize();

  return {
    x: snapToIncrement(point.x, halfGridSize),
    y: snapToIncrement(point.y, halfGridSize)
  };
}

function degreesToRadians(degrees) {
  return (Number(degrees ?? 0) * Math.PI) / 180;
}

function normalizeDegrees(degrees) {
  return ((degrees % 360) + 540) % 360 - 180;
}

function rotatePoint(point, degrees) {
  const radians = degreesToRadians(degrees);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos
  };
}

function cloneValue(value) {
  if (globalThis.foundry?.utils?.deepClone) return globalThis.foundry.utils.deepClone(value);
  if (globalThis.structuredClone) return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function clearNativeTemplatePreview(preview) {
  canvas.templates?.clearPreviewContainer?.();
  preview?.parent?.removeChild?.(preview);
  preview?.destroy?.({ children: true });

  if (canvas.templates?._preview === preview) {
    canvas.templates._preview = null;
  }
}

function getTemplateIconPath(template) {
  const originUuid = template?.document?.flags?.dnd5e?.origin;
  if (typeof originUuid === "string" && originUuid.trim()) {
    const source = globalThis.fromUuidSync?.(originUuid);
    const sourceImg = source?.img ?? source?.texture?.src;
    if (typeof sourceImg === "string" && sourceImg.trim()) return sourceImg;
  }

  const texturePath = template?.document?.texture ?? template?.document?.texture?.src;
  if (typeof texturePath === "string" && texturePath.trim()) return texturePath;

  return "icons/svg/explosion.svg";
}

function getTemplateIconOffset(templateData, gridPixels = GRID_PIXELS) {
  const type = templateData?.t ?? templateData?.type ?? "circle";
  const direction = Number(templateData?.direction ?? 0);
  const distancePixels = Math.max(templateDistanceToViewportPixels(templateData?.distance, gridPixels), gridPixels / 2);
  const widthPixels = Math.max(templateDistanceToViewportPixels(templateData?.width, gridPixels), gridPixels / 2);

  if (type === "ray") return rotatePoint({ x: distancePixels / 2, y: 0 }, direction);
  if (type === "rect") return rotatePoint({ x: distancePixels / 2, y: widthPixels / 2 }, direction);
  if (type === "cone") return rotatePoint({ x: distancePixels / 2, y: 0 }, direction);
  return { x: 0, y: 0 };
}

function endNativeTemplatePlacementMode() {
  const controls = ui.controls;
  const activeControl = controls?.activeControl ?? controls?.control?.name;
  if (activeControl !== "measure") return;

  if (typeof controls?.activateControl === "function") {
    controls.activateControl("token");
  }

  if (typeof controls?.activateTool === "function") {
    controls.activateTool("select");
  }
}

function hasActiveDisplay() {
  return Object.keys(activeDisplays).length > 0;
}

function isPrimaryPointerEvent(event) {
  return event.button === undefined || event.button === 0;
}

function isTemplateActionTarget(event) {
  return Boolean(event?.target?.closest?.("[data-companion-template-confirm], [data-companion-template-cancel], [data-companion-template-rotate-handle], [data-companion-zoom-in], [data-companion-zoom-out]"));
}

function blockMainCanvasTemplatePlacement(event) {
  if (!hasActiveDisplay() || !isPrimaryPointerEvent(event)) return;

  if (shouldSuppressMainTemplatePlacement()) {
    consumeSuppressedTemplateEvent(event);
    return;
  }

  if (!getActiveTemplatePreview()) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

function installCanvasTemplatePlacementGuard() {
  const canvasElement = canvas?.app?.view;
  if (canvasTemplatePlacementGuardInstalled || !canvasElement) return;

  for (const eventName of BLOCKED_TEMPLATE_PLACEMENT_EVENTS) {
    canvasElement.addEventListener(eventName, blockMainCanvasTemplatePlacement, true);
  }

  canvasTemplatePlacementGuardInstalled = true;
}

function installTemplateLayerPlacementGuard() {
  const templateLayer = canvas?.templates;
  if (!templateLayer || patchedTemplateLayers.has(templateLayer)) return;

  for (const methodName of BLOCKED_TEMPLATE_LAYER_METHODS) {
    const originalMethod = templateLayer[methodName];
    if (typeof originalMethod !== "function") continue;

    templateLayer[methodName] = function simpleCompanionTemplatePlacementGuard(event, ...args) {
      if (methodName === "_onClickLeft" && suppressedTemplateLayerClicksRemaining > 0) {
        suppressedTemplateLayerClicksRemaining -= 1;
        consumeSuppressedTemplateEvent(event);
        return false;
      }

      if (shouldSuppressMainTemplatePlacement()) {
        consumeSuppressedTemplateEvent(event);
        return false;
      }

      if (hasActiveDisplay() && getActiveTemplatePreview()) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        return false;
      }

      return originalMethod.call(this, event, ...args);
    };
  }

  patchedTemplateLayers.add(templateLayer);
}

function installMeasuredTemplatePreviewGuard() {
  const prototype = globalThis.CONFIG?.MeasuredTemplate?.objectClass?.prototype;
  if (measuredTemplatePreviewGuardInstalled || !prototype) return;

  for (const methodName of BLOCKED_TEMPLATE_PREVIEW_METHODS) {
    const originalMethod = prototype[methodName];
    if (typeof originalMethod !== "function") continue;

    prototype[methodName] = function simpleCompanionTemplatePreviewGuard(event, ...args) {
      if (hasActiveDisplay() && this.isPreview && getActiveTemplatePreview()) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        return false;
      }

      return originalMethod.call(this, event, ...args);
    };
  }

  measuredTemplatePreviewGuardInstalled = true;
}

const COMPANION_BUTTON_SELECTOR = [
  "[data-companion-panel]",
  "[data-companion-open-chat]",
  "[data-companion-roll-initiative]",
  "[data-companion-end-turn]",
  "[data-companion-zoom-in]",
  "[data-companion-zoom-out]",
  "[data-companion-template-confirm]",
  "[data-companion-template-cancel]",
  "[data-companion-template-rotate-handle]"
].join(", ");

export class PlayerDisplay extends Application {
  constructor(displayIndex, options = {}) {
    super(options);
    this.displayIndex = displayIndex;
    this.lastRefreshTime = 0;
    this.refreshDebounceDelay = 50; // ms
    this.pendingRefresh = null;
    this.activePanel = "combat";
    this.pendingTemplateData = null;
    this.pendingTemplateScreenPoint = null;
    this.pendingTemplateIconPath = null;
    this.viewportGridCount = Math.round(VIEWPORT_SIZE / GRID_PIXELS);
    this.viewportZoom = this.getViewportZoomForGridCount(this.viewportGridCount);
    this.templateCaptureInterval = null;
    this.isTemplateRotationDragging = false;
    this.templateRotationPointerId = null;
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

  getAssignedActorId() {
    return game.settings.get(MODULE_ID, `player${this.displayIndex}ActorId`);
  }

  isAssignedCombatant(combatant) {
    const actorId = this.getAssignedActorId();
    if (!actorId || !combatant) return false;

    return combatant.actor?.id === actorId
      || combatant.actorId === actorId
      || combatant.token?.actor?.id === actorId;
  }

  isAssignedActorTurn() {
    return this.isAssignedCombatant(game.combat?.combatant);
  }

  getToken() {
    const actor = this.getActor();
    if (!actor) return null;

    const tokens = actor.getActiveTokens().filter((token) => !isTokenHidden(token));
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
    const gridPixels = this.getViewportGridPixels();
    const halfGridPixels = gridPixels / 2;

    // Vertical lines
    for (let x = centerX - halfGridPixels; x >= 0; x -= gridPixels) {
      grid += `<div style="position:absolute;left:${x}px;top:0;width:1px;height:${VIEWPORT_SIZE}px;background:${GRID_COLOR};z-index:1;"></div>`;
    }

    for (let x = centerX + halfGridPixels; x < VIEWPORT_SIZE; x += gridPixels) {
      grid += `<div style="position:absolute;left:${x}px;top:0;width:1px;height:${VIEWPORT_SIZE}px;background:${GRID_COLOR};z-index:1;"></div>`;
    }

    // Horizontal lines
    for (let y = centerY - halfGridPixels; y >= 0; y -= gridPixels) {
      grid += `<div style="position:absolute;left:0;top:${y}px;width:${VIEWPORT_SIZE}px;height:1px;background:${GRID_COLOR};z-index:1;"></div>`;
    }

    for (let y = centerY + halfGridPixels; y < VIEWPORT_SIZE; y += gridPixels) {
      grid += `<div style="position:absolute;left:0;top:${y}px;width:${VIEWPORT_SIZE}px;height:1px;background:${GRID_COLOR};z-index:1;"></div>`;
    }

    return grid;
  }

  buildTemplatePreviewHtml() {
    const templateData = this.pendingTemplateData;
    const point = this.pendingTemplateScreenPoint ?? { x: VIEWPORT_SIZE / 2, y: VIEWPORT_SIZE / 2 };
    if (!templateData) return "";

    const highlightHtml = this.buildTemplateHighlightHtml(templateData, point);
    const gridPixels = this.getViewportGridPixels();
    const type = templateData.t ?? templateData.type ?? "circle";
    const distancePixels = Math.max(templateDistanceToViewportPixels(templateData.distance, gridPixels), gridPixels / 2);
    const widthPixels = Math.max(templateDistanceToViewportPixels(templateData.width, gridPixels), gridPixels / 2);
    const direction = Number(templateData.direction ?? 0);
    let shapeStyle = "";

    if (type === "ray") {
      shapeStyle = `
        left:${point.x}px;
        top:${point.y - widthPixels / 2}px;
        width:${distancePixels}px;
        height:${widthPixels}px;
        transform-origin:0 50%;
        transform:rotate(${direction}deg);
        border-radius:999px;
      `;
    } else if (type === "rect") {
      shapeStyle = `
        left:${point.x}px;
        top:${point.y}px;
        width:${distancePixels}px;
        height:${widthPixels}px;
        transform-origin:0 0;
        transform:rotate(${direction}deg);
      `;
    } else if (type === "cone") {
      const diameter = distancePixels * 2;
      shapeStyle = `
        left:${point.x - distancePixels}px;
        top:${point.y - distancePixels}px;
        width:${diameter}px;
        height:${diameter}px;
        border-radius:50%;
        clip-path:polygon(50% 50%, 100% 0, 100% 100%);
        transform:rotate(${direction}deg);
      `;
    } else {
      const diameter = distancePixels * 2;
      shapeStyle = `
        left:${point.x - distancePixels}px;
        top:${point.y - distancePixels}px;
        width:${diameter}px;
        height:${diameter}px;
        border-radius:50%;
      `;
    }

    return `
      <div id="simple-companion-template-highlights-${this.displayIndex}">
        ${highlightHtml}
      </div>
      <div id="simple-companion-template-preview-${this.displayIndex}" style="
        position:absolute;
        ${shapeStyle}
        border:2px dashed ${TEMPLATE_PREVIEW_COLOR};
        background:rgba(106,168,255,0.22);
        box-sizing:border-box;
        pointer-events:none;
        z-index:15;
      "></div>
      <div id="simple-companion-template-actions-${this.displayIndex}" style="
        position:absolute;
        left:${point.x}px;
        top:${Math.min(VIEWPORT_SIZE - 30, point.y + gridPixels)}px;
        transform:translateX(-50%);
        display:flex;
        gap:12px;
        z-index:20;
      ">
        <button type="button" data-companion-template-rotate-handle style="
          width:52px;
          height:52px;
          border-radius:14px;
          border:1px solid rgba(255,255,255,0.36);
          background:rgba(38,62,112,0.62);
          cursor:pointer;
          backdrop-filter:blur(2px);
          overflow:hidden;
          touch-action:none;
        " aria-label="Rotate template">
          <img src="${escapeHtml(this.pendingTemplateIconPath ?? "icons/svg/explosion.svg")}" style="width:100%;height:100%;object-fit:cover;pointer-events:none;">
        </button>
        <button type="button" data-companion-template-cancel style="
          width:52px;
          height:52px;
          border-radius:14px;
          border:1px solid rgba(255,255,255,0.36);
          background:rgba(151,45,45,0.62);
          color:#fff;
          font-size:24px;
          font-weight:700;
          cursor:pointer;
          backdrop-filter:blur(2px);
        " aria-label="Cancel template placement">
          <i class="fas fa-times"></i>
        </button>
        <button type="button" data-companion-template-confirm style="
          width:52px;
          height:52px;
          border-radius:14px;
          border:1px solid rgba(255,255,255,0.36);
          background:rgba(41,130,73,0.62);
          color:#fff;
          font-size:24px;
          font-weight:700;
          cursor:pointer;
          backdrop-filter:blur(2px);
        " aria-label="Confirm template placement">
          <i class="fas fa-check"></i>
        </button>
      </div>
    `;
  }

  getViewportGridPixels() {
    return GRID_PIXELS * this.viewportZoom;
  }

  getViewportHalfGridPixels() {
    return this.getViewportGridPixels() / 2;
  }

  getViewportVisibleGridCount() {
    return this.viewportGridCount;
  }

  getViewportMinGridCount() {
    return Math.ceil(VIEWPORT_SIZE / (GRID_PIXELS * VIEWPORT_ZOOM_MAX));
  }

  getViewportMaxGridCount() {
    return Math.floor(VIEWPORT_SIZE / (GRID_PIXELS * VIEWPORT_ZOOM_MIN));
  }

  getViewportZoomForGridCount(gridCount) {
    return VIEWPORT_SIZE / (GRID_PIXELS * gridCount);
  }

  buildTemplateHighlightHtml(templateData, point) {
    const affectedCells = this.getAffectedTemplateCells(templateData, point);
    const gridPixels = this.getViewportGridPixels();

    return affectedCells.map((cell) => `
      <div style="
        position:absolute;
        left:${cell.x - gridPixels / 2}px;
        top:${cell.y - gridPixels / 2}px;
        width:${gridPixels}px;
        height:${gridPixels}px;
        background:${TEMPLATE_HIGHLIGHT_COLOR};
        border:1px solid ${TEMPLATE_HIGHLIGHT_BORDER};
        box-sizing:border-box;
        pointer-events:none;
        z-index:4;
      "></div>
    `).join("");
  }

  getAffectedTemplateCells(templateData, point) {
    const affectedCells = [];
    const gridPixels = this.getViewportGridPixels();

    for (let y = 0; y < VIEWPORT_SIZE; y += gridPixels) {
      for (let x = 0; x < VIEWPORT_SIZE; x += gridPixels) {
        if (this.isTemplateAffectingPoint(templateData, point, { x, y })) {
          affectedCells.push({ x, y });
        }
      }
    }

    return affectedCells;
  }

  isTemplateAffectingPoint(templateData, origin, cellCenter) {
    const gridPixels = this.getViewportGridPixels();
    const type = templateData.t ?? templateData.type ?? "circle";
    const distancePixels = Math.max(templateDistanceToViewportPixels(templateData.distance, gridPixels), gridPixels / 2);
    const widthPixels = Math.max(templateDistanceToViewportPixels(templateData.width, gridPixels), gridPixels / 2);
    const direction = Number(templateData.direction ?? 0);
    const dx = cellCenter.x - origin.x;
    const dy = cellCenter.y - origin.y;

    if (type === "circle") {
      return Math.hypot(dx, dy) <= distancePixels;
    }

    const localPoint = rotatePoint({ x: dx, y: dy }, -direction);

    if (type === "ray") {
      return localPoint.x >= 0
        && localPoint.x <= distancePixels
        && Math.abs(localPoint.y) <= widthPixels / 2;
    }

    if (type === "rect") {
      return localPoint.x >= 0
        && localPoint.x <= distancePixels
        && localPoint.y >= 0
        && localPoint.y <= widthPixels;
    }

    if (type === "cone") {
      const angle = Number(templateData.angle ?? 90);
      const pointDistance = Math.hypot(dx, dy);
      const pointAngle = normalizeDegrees((Math.atan2(dy, dx) * 180) / Math.PI - direction);

      return pointDistance <= distancePixels && Math.abs(pointAngle) <= angle / 2;
    }

    return false;
  }

  buildViewportHtml() {
    const token = this.getToken();
    if (!token) return `<p>No token on current scene</p>`;

    const centerX = VIEWPORT_SIZE / 2;
    const centerY = VIEWPORT_SIZE / 2;
    const gridSize = canvas.grid.size;
    const gridPixels = this.getViewportGridPixels();

    const tokenCanvasCenter = getTokenCanvasCenter(token, gridSize);

    const grid = this.buildGridHtml();
    let tokensHtml = "";
    const activeTemplatesHtml = this.buildActiveTemplatesHtml(tokenCanvasCenter, gridSize);

    // Player token
    const tokenFootprint = getTokenFootprint(token, gridPixels);
    tokensHtml += this.buildTokenHtml(centerX, centerY, token, tokenFootprint);
    tokensHtml += this.buildLabelHtml(centerX, centerY, tokenFootprint, token.name);

    // Other tokens
    for (const otherToken of canvas.tokens.placeables) {
      if (otherToken.id === token.id) continue;
      if (isTokenHidden(otherToken)) continue;

      const otherCanvasCenter = getTokenCanvasCenter(otherToken, gridSize);

      const dx = (otherCanvasCenter.x - tokenCanvasCenter.x) / gridSize;
      const dy = (otherCanvasCenter.y - tokenCanvasCenter.y) / gridSize;

      const screenX = centerX + dx * gridPixels;
      const screenY = centerY + dy * gridPixels;

      if (screenX < -50 || screenX > VIEWPORT_SIZE + 50 || screenY < -50 || screenY > VIEWPORT_SIZE + 50) continue;

      const otherFootprint = getTokenFootprint(otherToken, gridPixels);
      tokensHtml += this.buildTokenHtml(screenX, screenY, otherToken, otherFootprint);
      tokensHtml += this.buildLabelHtml(screenX, screenY, otherFootprint, otherToken.name);
    }

    const templatePreviewHtml = this.buildTemplatePreviewHtml();

    const visibleGridCount = this.getViewportVisibleGridCount();

    return `
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
        ${activeTemplatesHtml}
        ${tokensHtml}
        ${templatePreviewHtml}

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

        <div style="
          position:absolute;
          right:10px;
          bottom:10px;
          display:flex;
          align-items:center;
          gap:6px;
          z-index:30;
          background:rgba(0,0,0,0.55);
          border:1px solid rgba(255,255,255,0.2);
          border-radius:12px;
          padding:6px;
        ">
          <button type="button" data-companion-zoom-out style="
            width:44px;
            height:44px;
            border-radius:10px;
            border:1px solid rgba(255,255,255,0.28);
            background:rgba(19,29,47,0.78);
            color:#fff;
            font-size:24px;
            line-height:1;
            cursor:pointer;
          ">-</button>
          <div style="min-width:54px; text-align:center; color:#fff; font-size:12px; font-weight:700;">${visibleGridCount}x${visibleGridCount}</div>
          <button type="button" data-companion-zoom-in style="
            width:44px;
            height:44px;
            border-radius:10px;
            border:1px solid rgba(255,255,255,0.28);
            background:rgba(19,29,47,0.78);
            color:#fff;
            font-size:24px;
            line-height:1;
            cursor:pointer;
          ">+</button>
        </div>
      </div>
    `;
  }

  buildLabelHtml(x, y, footprint, name) {
    const safeName = escapeHtml(name);

    return `
      <div style="
        position: absolute;
        left: ${x}px;
        top: ${y + footprint.height / 2 + 2}px;
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

  buildTokenHtml(x, y, token, footprint) {
    const img = escapeHtml(token.document.texture?.src);
    const tokenName = escapeHtml(token.name);
    const ringColor = getTokenRingColor(token);
    const imageInset = Math.min(TOKEN_FOOTPRINT_PADDING, footprint.width / 6, footprint.height / 6);

    if (img) {
      return `
        <div title="${tokenName}" style="
          position: absolute;
          left: ${x - footprint.width / 2}px;
          top: ${y - footprint.height / 2}px;
          width: ${footprint.width}px;
          height: ${footprint.height}px;
          border-radius: 50%;
          border: 2px solid ${ringColor};
          padding: ${imageInset}px;
          overflow: hidden;
          z-index: 10;
          background: ${ringColor};
          box-sizing: border-box;
        ">
          <img src="${img}" style="
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 50%;
          ">
        </div>
      `;
    }

    return `
      <div title="${tokenName}" style="
        position: absolute;
        left: ${x - footprint.width / 2}px;
        top: ${y - footprint.height / 2}px;
        width: ${footprint.width}px;
        height: ${footprint.height}px;
        background: ${ringColor};
        border-radius: 50%;
        border: 2px solid ${ringColor};
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

  buildTurnOrderPanelHtml() {
    const combat = game.combat;
    if (!combat) {
      return `<div style="padding:14px; color:#aaa;">No active combat encounter.</div>`;
    }

    const canRoll = combat.canUserModify(game.user, "update");
    const sceneName = escapeHtml(getSceneNameForCombat(combat));
    const round = escapeHtml(combat.round ?? "-");
    const turn = escapeHtml((combat.turn ?? 0) + 1);
    const activeCombatantId = combat.combatant?.id;
    const combatants = collectionValues(combat.turns ?? combat.combatants);

    const combatantsHtml = combatants.map((combatant) => {
      const isTurn = activeCombatantId && combatant.id === activeCombatantId;
      const isAssigned = this.isAssignedCombatant(combatant);
      const name = escapeHtml(combatant.name);
      const initiative = combatant.initiative ?? "-";
      const initiativeHtml = combatant.initiative == null && canRoll && isAssigned
        ? `<button type="button" data-companion-roll-initiative="${combatant.id}" title="Roll Initiative" style="
            width:34px;
            height:28px;
            border:1px solid #656d7c;
            background:#273140;
            color:#fff;
            cursor:pointer;
          "><i class="fas fa-dice-d20"></i></button>`
        : `<div style="width:34px; color:#c4cad5; text-align:right;">${escapeHtml(initiative)}</div>`;

      return `
        <div style="
          display:flex;
          align-items:center;
          gap:8px;
          padding:8px 10px;
          background:${isTurn ? "rgba(190, 130, 45, 0.28)" : "rgba(255,255,255,0.04)"};
          border-bottom:1px solid rgba(255,255,255,0.07);
        ">
          ${initiativeHtml}
          <div style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${name}</div>
          <div style="width:18px; text-align:center; color:${isTurn ? "#f3c16b" : "#6f7785"};">
            ${isTurn ? `<i class="fas fa-arrow-right"></i>` : ""}
          </div>
        </div>
      `;
    }).join("");

    return `
      <section>
        <div style="padding:10px 12px; background:#181b22; border-bottom:1px solid #3a3f49;">
          <div style="display:flex; justify-content:space-between; gap:8px; color:#fff;">
            <strong style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sceneName}</strong>
            <span style="color:#c4cad5;">Round ${round} | Turn ${turn}</span>
          </div>
        </div>
        ${combatantsHtml || `<div style="padding:10px 12px; color:#aaa;">No combatants.</div>`}
      </section>
    `;
  }

  buildChatPanelHtml() {
    return `
      <div style="padding:16px; color:#c4cad5; line-height:1.4;">
        Foundry chat opens in its native popout so rolls, cards, whispers, and chat controls behave normally.
      </div>
      <div style="padding:0 16px 16px;">
        <button type="button" data-companion-open-chat style="
          width:100%;
          height:40px;
          border:1px solid #656d7c;
          background:#273140;
          color:#fff;
          cursor:pointer;
        ">
          <i class="fas fa-comments"></i> Open Chat
        </button>
      </div>
    `;
  }

  buildSidePanelHtml() {
    const panelHtml = this.activePanel === "chat" ? this.buildChatPanelHtml() : this.buildTurnOrderPanelHtml();
    const canEndTurn = this.isAssignedActorTurn();

    return `
      <aside style="
        width: ${SIDE_PANEL_WIDTH}px;
        min-width: 320px;
        max-width: 42%;
        height: ${SIDE_PANEL_HEIGHT}px;
        border: 2px solid #555;
        background:#101218;
        color:#e5e8ef;
        display:flex;
        flex-direction:column;
        overflow:hidden;
      " id="simple-companion-side-panel-${this.displayIndex}">
        <div style="
          height:44px;
          display:flex;
          border-bottom:1px solid #555;
          background:#20242d;
        ">
          ${this.buildPanelButton("combat", "fas fa-swords", "Combat Encounters")}
          ${this.buildPanelButton("chat", "fas fa-comments", "Chat Messages")}
        </div>
        <div style="flex:1; overflow:auto;" id="simple-companion-side-panel-body-${this.displayIndex}">
          ${panelHtml}
        </div>
        <div style="padding:10px 12px; border-top:1px solid #555; background:#181b22;">
          <button type="button" data-companion-end-turn ${canEndTurn ? "" : "disabled"} title="${canEndTurn ? "End Turn" : "Only available on this character's turn"}" style="
            width:100%;
            height:42px;
            border:1px solid #656d7c;
            background:${canEndTurn ? "#273140" : "#20242d"};
            color:${canEndTurn ? "#fff" : "#7f8796"};
            cursor:${canEndTurn ? "pointer" : "not-allowed"};
            font-weight:700;
          ">
            <i class="fas fa-forward"></i> End Turn
          </button>
        </div>
      </aside>
    `;
  }

  async _renderInner() {
    return $(`
      <div style="padding:20px; font-size:16px;">
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
    `);
  }

  activateListeners(html) {
    super.activateListeners(html);

    if (typeof html?.find === "function") {
      html.find(COMPANION_BUTTON_SELECTOR).off("click.simpleCompanion").on("click.simpleCompanion", (event) => {
        this.handleCompanionButtonClick(event, event.currentTarget);
      });
    }

    const element = getHtmlElement(html);
    const viewport = element?.querySelector?.(`#simple-companion-viewport-${this.displayIndex}`);
    viewport?.addEventListener?.("click", (event) => this.handleViewportClick(event));
    viewport?.addEventListener?.("pointerdown", (event) => this.handleViewportPointerDown(event));
    viewport?.addEventListener?.("pointermove", (event) => this.handleViewportPointerMove(event));
    viewport?.addEventListener?.("pointerup", (event) => this.stopTemplateRotationDrag(event));
    viewport?.addEventListener?.("pointercancel", (event) => this.stopTemplateRotationDrag(event));
    installCanvasTemplatePlacementGuard();
    installTemplateLayerPlacementGuard();
    installMeasuredTemplatePreviewGuard();
    this.startTemplateCapture();

    element?.addEventListener?.("click", (event) => {
      const target = event.target?.closest?.(COMPANION_BUTTON_SELECTOR);
      if (target && element.contains?.(target)) {
        this.handleCompanionButtonClick(event, target);
      }
    });

    element?.addEventListener?.("pointerdown", (event) => {
      const target = event.target?.closest?.("[data-companion-template-rotate-handle]");
      if (target && element.contains?.(target)) {
        this.startTemplateRotationDrag(event);
      }
    });
  }

  startTemplateCapture() {
    if (this.templateCaptureInterval) return;

    this.templateCaptureInterval = setInterval(() => {
      if (this.captureActiveTemplatePreview()) {
        this.refresh();
      }
    }, TEMPLATE_CAPTURE_INTERVAL);
  }

  captureActiveTemplatePreview() {
    if (this.pendingTemplateData) return false;

    const preview = getActiveTemplatePreview();
    if (!preview?.document?.toObject) return false;

    const templateData = preview.document.toObject();
    delete templateData._id;
    this.pendingTemplateData = templateData;
    this.pendingTemplateScreenPoint = { x: VIEWPORT_SIZE / 2, y: VIEWPORT_SIZE / 2 };
    this.pendingTemplateIconPath = getTemplateIconPath(preview);

    clearNativeTemplatePreview(preview);
    endNativeTemplatePlacementMode();
    return true;
  }

  buildActiveTemplatesHtml(tokenCanvasCenter, gridSize) {
    const templates = canvas.templates?.placeables ?? [];
    if (!templates.length) return "";

    const centerX = VIEWPORT_SIZE / 2;
    const centerY = VIEWPORT_SIZE / 2;
    const gridPixels = this.getViewportGridPixels();
    const elements = [];

    for (const template of templates) {
      const templateData = template?.document?.toObject?.();
      if (!templateData) continue;

      const originX = centerX + ((templateData.x - tokenCanvasCenter.x) / gridSize) * gridPixels;
      const originY = centerY + ((templateData.y - tokenCanvasCenter.y) / gridSize) * gridPixels;
      if (originX < -220 || originX > VIEWPORT_SIZE + 220 || originY < -220 || originY > VIEWPORT_SIZE + 220) continue;

      const type = templateData.t ?? templateData.type ?? "circle";
      const distancePixels = Math.max(templateDistanceToViewportPixels(templateData.distance, gridPixels), gridPixels / 2);
      const widthPixels = Math.max(templateDistanceToViewportPixels(templateData.width, gridPixels), gridPixels / 2);
      const direction = Number(templateData.direction ?? 0);
      const iconOffset = getTemplateIconOffset(templateData, gridPixels);
      const iconPath = escapeHtml(getTemplateIconPath(template));

      let shapeStyle = "";

      if (type === "ray") {
        shapeStyle = `
          left:${originX}px;
          top:${originY - widthPixels / 2}px;
          width:${distancePixels}px;
          height:${widthPixels}px;
          transform-origin:0 50%;
          transform:rotate(${direction}deg);
          border-radius:999px;
        `;
      } else if (type === "rect") {
        shapeStyle = `
          left:${originX}px;
          top:${originY}px;
          width:${distancePixels}px;
          height:${widthPixels}px;
          transform-origin:0 0;
          transform:rotate(${direction}deg);
        `;
      } else if (type === "cone") {
        const diameter = distancePixels * 2;
        shapeStyle = `
          left:${originX - distancePixels}px;
          top:${originY - distancePixels}px;
          width:${diameter}px;
          height:${diameter}px;
          border-radius:50%;
          clip-path:polygon(50% 50%, 100% 0, 100% 100%);
          transform:rotate(${direction}deg);
        `;
      } else {
        const diameter = distancePixels * 2;
        shapeStyle = `
          left:${originX - distancePixels}px;
          top:${originY - distancePixels}px;
          width:${diameter}px;
          height:${diameter}px;
          border-radius:50%;
        `;
      }

      elements.push(`
        <div style="
          position:absolute;
          ${shapeStyle}
          border:2px solid ${ACTIVE_TEMPLATE_BORDER};
          background:${ACTIVE_TEMPLATE_FILL};
          box-sizing:border-box;
          pointer-events:none;
          z-index:6;
        "></div>
      `);

      elements.push(`
        <div style="
          position:absolute;
          left:${originX + iconOffset.x}px;
          top:${originY + iconOffset.y}px;
          width:30px;
          height:30px;
          transform:translate(-50%, -50%);
          border-radius:50%;
          border:1px solid rgba(214,231,255,0.9);
          background:rgba(13,24,44,0.72);
          box-shadow:0 2px 8px rgba(0,0,0,0.35);
          overflow:hidden;
          pointer-events:none;
          z-index:7;
        ">
          <img src="${iconPath}" style="width:100%;height:100%;object-fit:cover;">
        </div>
      `);
    }

    return elements.join("");
  }

  async handleCompanionButtonClick(event, target) {
    event.preventDefault();
    event.stopPropagation();

    if (target.dataset.companionPanel) {
      this.activePanel = target.dataset.companionPanel;
      this.render(false);

      if (this.activePanel === "chat") {
        await this.openNativeChatPopout();
      }
    } else if (target.dataset.companionOpenChat !== undefined) {
      await this.openNativeChatPopout();
    } else if (target.dataset.companionRollInitiative) {
      const combatant = game.combat?.combatants?.get?.(target.dataset.companionRollInitiative);
      if (!this.isAssignedCombatant(combatant)) return;

      await game.combat?.rollInitiative(target.dataset.companionRollInitiative, { updateTurn: true });
      this.refresh();
    } else if (target.dataset.companionEndTurn !== undefined) {
      if (!this.isAssignedActorTurn()) return;

      await game.combat?.nextTurn();
      this.refresh();
    } else if (target.dataset.companionZoomIn !== undefined) {
      this.adjustViewportGridCount(-1);
    } else if (target.dataset.companionZoomOut !== undefined) {
      this.adjustViewportGridCount(1);
    } else if (target.dataset.companionTemplateConfirm !== undefined) {
      await this.confirmTemplatePlacement(event);
    } else if (target.dataset.companionTemplateCancel !== undefined) {
      this.cancelTemplatePlacement(event);
    }
  }

  adjustViewportGridCount(deltaTiles) {
    const minCount = this.getViewportMinGridCount();
    const maxCount = this.getViewportMaxGridCount();
    const nextCount = Math.min(maxCount, Math.max(minCount, this.viewportGridCount + deltaTiles));
    if (nextCount === this.viewportGridCount) return;

    this.viewportGridCount = nextCount;
    this.viewportZoom = this.getViewportZoomForGridCount(this.viewportGridCount);
    this.refresh();
  }

  startTemplateRotationDrag(event) {
    if (!this.pendingTemplateData || !isPrimaryPointerEvent(event)) return;

    const viewport = event.target?.closest?.(`#simple-companion-viewport-${this.displayIndex}`);
    if (!viewport) return;

    this.isTemplateRotationDragging = true;
    this.templateRotationPointerId = event.pointerId;
    viewport.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  stopTemplateRotationDrag(event) {
    if (!this.isTemplateRotationDragging) return;
    if (event?.pointerId !== undefined && this.templateRotationPointerId !== null && event.pointerId !== this.templateRotationPointerId) return;

    const viewport = event?.currentTarget;
    if (viewport?.releasePointerCapture && this.templateRotationPointerId !== null) {
      viewport.releasePointerCapture(this.templateRotationPointerId);
    }

    this.isTemplateRotationDragging = false;
    this.templateRotationPointerId = null;
  }

  rotatePendingTemplateToViewportPoint(viewportPoint) {
    if (!this.pendingTemplateData || !viewportPoint) return;

    const originPoint = this.pendingTemplateScreenPoint ?? { x: VIEWPORT_SIZE / 2, y: VIEWPORT_SIZE / 2 };
    const gridPixels = this.getViewportGridPixels();
    const previousOffset = getTemplateIconOffset(this.pendingTemplateData, gridPixels);
    const centerPoint = {
      x: originPoint.x + previousOffset.x,
      y: originPoint.y + previousOffset.y
    };

    const angleDegrees = (Math.atan2(viewportPoint.y - centerPoint.y, viewportPoint.x - centerPoint.x) * 180) / Math.PI;
    this.pendingTemplateData.direction = angleDegrees;

    const nextOffset = getTemplateIconOffset(this.pendingTemplateData, gridPixels);
    this.pendingTemplateScreenPoint = snapViewportPointToHalfGrid({
      x: centerPoint.x - nextOffset.x,
      y: centerPoint.y - nextOffset.y
    }, this.getViewportHalfGridPixels());

    this.updateTemplatePreviewOverlay();
  }

  getViewportScenePoint(event) {
    const token = this.getToken();
    if (!token || !canvas.scene) return null;

    const viewportPoint = this.getViewportScreenPoint(event);
    if (!viewportPoint) return null;

    const gridSize = canvas.grid.size;
    const gridPixels = this.getViewportGridPixels();
    const tokenCanvasCenter = getTokenCanvasCenter(token, gridSize);

    const scenePoint = {
      x: tokenCanvasCenter.x + ((viewportPoint.x - VIEWPORT_SIZE / 2) / gridPixels) * gridSize,
      y: tokenCanvasCenter.y + ((viewportPoint.y - VIEWPORT_SIZE / 2) / gridPixels) * gridSize
    };

    return snapScenePointToHalfGrid(scenePoint);
  }

  getViewportScreenPoint(event) {
    const viewport = event.currentTarget;
    if (!viewport?.getBoundingClientRect) return null;

    const rect = viewport.getBoundingClientRect();

    const rawPoint = {
      x: ((event.clientX - rect.left) / rect.width) * VIEWPORT_SIZE,
      y: ((event.clientY - rect.top) / rect.height) * VIEWPORT_SIZE
    };

    return snapViewportPointToHalfGrid(rawPoint, this.getViewportHalfGridPixels());
  }

  updateTemplatePreviewOverlay() {
    const point = this.pendingTemplateScreenPoint;
    if (!this.pendingTemplateData || !point) return;

    const element = getHtmlElement(this.element);
    const preview = element?.querySelector?.(`#simple-companion-template-preview-${this.displayIndex}`);
    const highlights = element?.querySelector?.(`#simple-companion-template-highlights-${this.displayIndex}`);
    const actions = element?.querySelector?.(`#simple-companion-template-actions-${this.displayIndex}`);

    if (!preview || !highlights || !actions) {
      this.refresh();
      return;
    }

    const type = this.pendingTemplateData.t ?? this.pendingTemplateData.type ?? "circle";
    const gridPixels = this.getViewportGridPixels();
    const distancePixels = Math.max(templateDistanceToViewportPixels(this.pendingTemplateData.distance, gridPixels), gridPixels / 2);
    const widthPixels = Math.max(templateDistanceToViewportPixels(this.pendingTemplateData.width, gridPixels), gridPixels / 2);
    const direction = Number(this.pendingTemplateData.direction ?? 0);

    highlights.innerHTML = this.buildTemplateHighlightHtml(this.pendingTemplateData, point);
    actions.style.left = `${point.x}px`;
    actions.style.top = `${Math.min(VIEWPORT_SIZE - 30, point.y + gridPixels)}px`;
    preview.style.display = "block";
    preview.style.transform = "";
    preview.style.clipPath = "";
    preview.style.borderRadius = "";

    if (type === "ray") {
      preview.style.left = `${point.x}px`;
      preview.style.top = `${point.y - widthPixels / 2}px`;
      preview.style.width = `${distancePixels}px`;
      preview.style.height = `${widthPixels}px`;
      preview.style.transformOrigin = "0 50%";
      preview.style.transform = `rotate(${direction}deg)`;
      preview.style.borderRadius = "999px";
    } else if (type === "rect") {
      preview.style.left = `${point.x}px`;
      preview.style.top = `${point.y}px`;
      preview.style.width = `${distancePixels}px`;
      preview.style.height = `${widthPixels}px`;
      preview.style.transformOrigin = "0 0";
      preview.style.transform = `rotate(${direction}deg)`;
    } else if (type === "cone") {
      const diameter = distancePixels * 2;
      preview.style.left = `${point.x - distancePixels}px`;
      preview.style.top = `${point.y - distancePixels}px`;
      preview.style.width = `${diameter}px`;
      preview.style.height = `${diameter}px`;
      preview.style.borderRadius = "50%";
      preview.style.clipPath = "polygon(50% 50%, 100% 0, 100% 100%)";
      preview.style.transform = `rotate(${direction}deg)`;
    } else {
      const diameter = distancePixels * 2;
      preview.style.left = `${point.x - distancePixels}px`;
      preview.style.top = `${point.y - distancePixels}px`;
      preview.style.width = `${diameter}px`;
      preview.style.height = `${diameter}px`;
      preview.style.borderRadius = "50%";
    }
  }

  syncTemplatePreviewToViewport(event) {
    this.captureActiveTemplatePreview();
    if (this.pendingTemplateData) {
      const viewportPoint = this.getViewportScreenPoint(event);
      if (viewportPoint) {
        this.pendingTemplateScreenPoint = viewportPoint;
        this.updateTemplatePreviewOverlay();
      }

      return {
        templateData: this.pendingTemplateData,
        snappedPoint: this.getViewportScenePoint(event)
      };
    }

    const preview = getActiveTemplatePreview();
    if (!preview?.document?.updateSource) return null;

    const snappedPoint = this.getViewportScenePoint(event);
    if (!snappedPoint) return null;

    preview.document.updateSource({
      x: snappedPoint.x,
      y: snappedPoint.y
    });
    preview.refresh?.();
    preview.renderFlags?.set?.({ refresh: true });
    preview.position?.set?.(snappedPoint.x, snappedPoint.y);

    return { preview, snappedPoint };
  }

  handleViewportPointerMove(event) {
    if (this.isTemplateRotationDragging && this.pendingTemplateData) {
      if (this.templateRotationPointerId !== null && event.pointerId !== this.templateRotationPointerId) return;
      const viewportPoint = this.getViewportScreenPoint(event);
      if (viewportPoint) this.rotatePendingTemplateToViewportPoint(viewportPoint);
      return;
    }

    if (this.pendingTemplateData) return;
    this.syncTemplatePreviewToViewport(event);
  }

  async handleViewportPointerDown(event) {
    if (isTemplateActionTarget(event)) return;
    if (!isPrimaryPointerEvent(event)) return;
    await this.handleViewportClick(event);
  }

  async handleViewportClick(event) {
    if (isTemplateActionTarget(event)) return;

    if (this.pendingTemplateData) {
      const previewState = this.syncTemplatePreviewToViewport(event);
      if (!previewState?.snappedPoint) return;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const previewState = this.syncTemplatePreviewToViewport(event);
    const preview = previewState?.preview ?? getActiveTemplatePreview();
    if (!preview?.document?.toObject && !previewState?.templateData) return;
    const snappedPoint = previewState?.snappedPoint ?? this.getViewportScenePoint(event);
    if (!snappedPoint || !canvas.scene) return;

    this.pendingTemplateData = previewState?.templateData
      ? cloneValue(previewState.templateData)
      : preview.document.toObject();
    delete this.pendingTemplateData._id;
    this.pendingTemplateIconPath = getTemplateIconPath(preview);
    this.pendingTemplateScreenPoint = this.getViewportScreenPoint(event) ?? this.pendingTemplateScreenPoint ?? { x: VIEWPORT_SIZE / 2, y: VIEWPORT_SIZE / 2 };

    clearNativeTemplatePreview(preview);
    endNativeTemplatePlacementMode();

    event.preventDefault();
    event.stopPropagation();
    this.refresh();
  }

  getViewportScenePointFromScreenPoint(viewportPoint) {
    const token = this.getToken();
    if (!token || !canvas.scene || !viewportPoint) return null;

    const gridSize = canvas.grid.size;
    const gridPixels = this.getViewportGridPixels();
    const tokenCanvasCenter = getTokenCanvasCenter(token, gridSize);

    const scenePoint = {
      x: tokenCanvasCenter.x + ((viewportPoint.x - VIEWPORT_SIZE / 2) / gridPixels) * gridSize,
      y: tokenCanvasCenter.y + ((viewportPoint.y - VIEWPORT_SIZE / 2) / gridPixels) * gridSize
    };

    return snapScenePointToHalfGrid(scenePoint);
  }

  async confirmTemplatePlacement(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (!this.pendingTemplateData || !canvas.scene) return;

    const viewportPoint = this.pendingTemplateScreenPoint ?? { x: VIEWPORT_SIZE / 2, y: VIEWPORT_SIZE / 2 };
    const snappedPoint = this.getViewportScenePointFromScreenPoint(viewportPoint);
    if (!snappedPoint) return;

    const templateData = cloneValue(this.pendingTemplateData);
    delete templateData._id;
    templateData.x = snappedPoint.x;
    templateData.y = snappedPoint.y;

    await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);
    canvas.templates.clearPreviewContainer?.();
    clearNativeTemplatePreview(getActiveTemplatePreview());
    endNativeTemplatePlacementMode();
    this.pendingTemplateData = null;
    this.pendingTemplateScreenPoint = null;
    this.pendingTemplateIconPath = null;
    this.isTemplateRotationDragging = false;
    this.templateRotationPointerId = null;
    suppressMainTemplatePlacementFor();
    suppressNextTemplateLayerClicks(1);
    suppressNextMeasuredTemplateCreates(1);
    this.refresh();
  }

  cancelTemplatePlacement(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    this.pendingTemplateData = null;
    this.pendingTemplateScreenPoint = null;
    this.pendingTemplateIconPath = null;
    this.isTemplateRotationDragging = false;
    this.templateRotationPointerId = null;
    clearNativeTemplatePreview(getActiveTemplatePreview());
    endNativeTemplatePlacementMode();
    suppressMainTemplatePlacementFor();
    suppressNextTemplateLayerClicks(1);
    suppressNextMeasuredTemplateCreates(1);
    this.refresh();
  }

  async openNativeChatPopout() {
    const chat = ui.sidebar?.tabs?.chat ?? ui.sidebar?.tabs?.get?.("chat") ?? ui.chat;
    if (!chat?.renderPopout) {
      ui.sidebar?.activateTab?.("chat");
      ui.sidebar?.changeTab?.("chat", "primary");
      return;
    }

    const popout = await chat.renderPopout();
    const element = getHtmlElement(this.element);
    const panelBody = element?.querySelector?.(`#simple-companion-side-panel-body-${this.displayIndex}`);
    const rect = panelBody?.getBoundingClientRect?.();

    if (rect && popout?.setPosition) {
      popout.setPosition({
        left: Math.max(0, rect.left),
        top: Math.max(0, rect.top),
        width: rect.width,
        height: rect.height
      });
    }

    popout?.bringToFront?.();
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
    if (this.templateCaptureInterval) {
      clearInterval(this.templateCaptureInterval);
      this.templateCaptureInterval = null;
    }
    delete activeDisplays[this.displayIndex];
    return super.close(options);
  }
}
