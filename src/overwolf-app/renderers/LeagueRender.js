const LIVEHUB_CANVAS_WIDTH = 1920;
const LIVEHUB_CANVAS_HEIGHT = 1080;
const LIVEHUB_BROWSER_SOURCE_KIND = "browser_source";
const LIVEHUB_BROWSER_EVENT_NAME = "livehub-render-state";
const LIVEHUB_OVERLAY_FOLDER = "LiveStreamHUB/obs-overlays";

const LEAGUE_RENDER_TYPES = Object.freeze({
    kills: "Kills",
    towers: "Towers",
    voidGrubs: "VoidGrubs",
    riftHerald: "RiftHerald",
    dragon: "Dragon",
    teamGold: "TeamGold",
    goldDiff: "GoldDiff",
    playerScore: "PlayerScore",
    playerCreepScore: "PlayerCreepScore",
    playerGold: "PlayerGold",
    playerItems: "PlayerItems",
    playerName: "PlayerName",
    playerLevel: "PlayerLevel",
    championName: "ChampionName",
    championPortrait: "ChampionPortrait",
    lolScorebug: "LolScorebug",
    lolPlayerRoster: "LolPlayerRoster",
    time: "Time"
});

const TEAM_SCOPED_RENDER_TYPES = new Set([
    LEAGUE_RENDER_TYPES.kills,
    LEAGUE_RENDER_TYPES.towers,
    LEAGUE_RENDER_TYPES.voidGrubs,
    LEAGUE_RENDER_TYPES.riftHerald,
    LEAGUE_RENDER_TYPES.dragon,
    LEAGUE_RENDER_TYPES.teamGold,
    LEAGUE_RENDER_TYPES.playerScore,
    LEAGUE_RENDER_TYPES.playerCreepScore,
    LEAGUE_RENDER_TYPES.playerGold,
    LEAGUE_RENDER_TYPES.playerItems,
    LEAGUE_RENDER_TYPES.playerName,
    LEAGUE_RENDER_TYPES.playerLevel,
    LEAGUE_RENDER_TYPES.championName,
    LEAGUE_RENDER_TYPES.championPortrait,
    LEAGUE_RENDER_TYPES.lolPlayerRoster
]);

const PLAYER_ROLE_ORDER = ["top", "jungle", "mid", "adc", "support"];

class LeagueRender {
    constructor(options) {
        this.obsClient = options.obsClient;
        this.hubApi = options.hubApi;
        this.onStatus = options.onStatus || (() => { });
        this.targets = [];
        this.overlay = null;
        this.prepared = false;
        this.rendering = false;
        this.pendingState = null;
        this.lastRenderPayloadJson = null;
        this.status = {
            state: "idle",
            prepared: false,
            message: "OBS render is not prepared.",
            sceneName: null,
            userId: null,
            hubId: null,
            hubName: null,
            browserSourceName: null,
            overlayFilePath: null,
            layers: [],
            preview: null,
            updatedAt: new Date().toISOString()
        };
    }

    async prepare(options) {
        this.updateStatus({
            state: "connecting",
            prepared: false,
            message: "Connecting to OBS."
        });

        try {
            await this.obsClient.connect({
                password: (options && options.obsPassword) || ""
            });

            const sceneName = await this.getCurrentSceneName();
            const sceneIds = parseLiveHubSceneName(sceneName);

            this.updateStatus({
                state: "loading-hub",
                sceneName,
                userId: sceneIds.userId,
                hubId: sceneIds.hubId,
                message: "Loading hub from backend."
            });

            const hub = await this.hubApi.getHubByOwner(sceneIds.userId, sceneIds.hubId);
            const initialValues = getLeagueRenderValues(options && options.initialState);
            const initialPreview = getLeagueRenderPreview(initialValues);
            const targets = this.resolveTargets(hub);

            this.updateStatus({
                state: "creating-overlay",
                hubName: hub.hubName || sceneIds.hubId,
                layers: targets.map(createStatusLayer),
                preview: initialPreview,
                message: "Creating OBS browser source."
            });

            const overlay = await this.ensureBrowserOverlay(
                sceneName,
                sceneIds,
                hub,
                initialValues,
                initialPreview
            );

            this.targets = targets;
            this.overlay = overlay;
            this.prepared = true;
            this.lastRenderPayloadJson = null;
            this.updateStatus({
                state: "ready",
                prepared: true,
                browserSourceName: overlay.inputName,
                overlayFilePath: overlay.filePath,
                message: getReadyMessage(targets.length)
            });

            return this.getStatus();
        }
        catch (error) {
            this.prepared = false;
            this.targets = [];
            this.overlay = null;
            this.updateStatus({
                state: "error",
                prepared: false,
                browserSourceName: null,
                overlayFilePath: null,
                message: getErrorMessage(error)
            });
            throw error;
        }
    }

    queueRender(state) {
        if (!this.prepared) {
            return;
        }

        this.pendingState = state;

        if (!this.rendering) {
            void this.flushRenderQueue();
        }
    }

    getStatus() {
        return {
            ...this.status,
            layers: this.status.layers.map((layer) => ({ ...layer })),
            preview: this.status.preview ? { ...this.status.preview } : null
        };
    }

    async getCurrentSceneName() {
        const response = await this.obsClient.call("GetCurrentProgramScene");
        const sceneName = response.currentProgramSceneName;

        if (!sceneName) {
            throw new Error("OBS did not return a current scene name.");
        }

        return sceneName;
    }

    resolveTargets(hub) {
        return getHubLayers(hub)
            .filter((layer) => layer && layer.visible !== false && isSupportedStatLayer(layer))
            .map((layer) => ({
                layer,
                type: normalizeStatLayerType(layer.type),
                team: getStatLayerTeam(layer),
                role: getPlayerScoreRole(layer)
            }));
    }

    async ensureBrowserOverlay(sceneName, sceneIds, hub, initialValues, initialPreview) {
        await this.assertBrowserSourceSupported();

        const inputName = getLiveHubBrowserSourceName(sceneIds);
        const filePath = await this.writeOverlayHtml(sceneIds, hub, initialValues, initialPreview);
        const inputSettings = getBrowserSourceInputSettings(filePath);
        const existingInputKind = await this.getExistingInputKind(inputName);

        if (existingInputKind && existingInputKind !== LIVEHUB_BROWSER_SOURCE_KIND) {
            await this.obsClient.call("RemoveInput", { inputName });
        }

        if (existingInputKind === LIVEHUB_BROWSER_SOURCE_KIND) {
            await this.obsClient.call("SetInputSettings", {
                inputName,
                inputSettings,
                overlay: true
            });
        }
        else {
            await this.obsClient.call("CreateInput", {
                sceneName,
                inputName,
                inputKind: LIVEHUB_BROWSER_SOURCE_KIND,
                inputSettings
            });
        }

        const sceneItemId = await this.ensureSceneItem(sceneName, inputName);
        await this.applyBrowserSourceTransform(sceneName, sceneItemId);
        await this.refreshBrowserSource(inputName);

        return {
            inputName,
            filePath
        };
    }

    async assertBrowserSourceSupported() {
        const response = await this.obsClient.call("GetInputKindList");
        const inputKinds = Array.isArray(response.inputKinds) ? response.inputKinds : [];

        if (!inputKinds.includes(LIVEHUB_BROWSER_SOURCE_KIND)) {
            throw new Error("OBS does not support Browser Source inputs.");
        }
    }

    async getExistingInputKind(inputName) {
        const response = await this.obsClient.call("GetInputList");
        const inputs = Array.isArray(response.inputs) ? response.inputs : [];
        const input = inputs.find((candidate) => candidate.inputName === inputName);

        return input && typeof input.inputKind === "string" ? input.inputKind : null;
    }

    async ensureSceneItem(sceneName, inputName) {
        const sceneItemId = await this.getSceneItemId(sceneName, inputName);

        if (sceneItemId !== null) {
            return sceneItemId;
        }

        const response = await this.obsClient.call("CreateSceneItem", {
            sceneName,
            sourceName: inputName,
            sceneItemEnabled: true
        });

        if (Number.isFinite(Number(response.sceneItemId))) {
            return response.sceneItemId;
        }

        const createdSceneItemId = await this.getSceneItemId(sceneName, inputName);

        if (createdSceneItemId === null) {
            throw new Error("OBS created the browser source, but did not add it to the scene.");
        }

        return createdSceneItemId;
    }

    async getSceneItemId(sceneName, inputName) {
        try {
            const response = await this.obsClient.call("GetSceneItemId", {
                sceneName,
                sourceName: inputName
            });

            return Number.isFinite(Number(response.sceneItemId)) ? response.sceneItemId : null;
        }
        catch {
            return null;
        }
    }

    async applyBrowserSourceTransform(sceneName, sceneItemId) {
        await this.obsClient.call("SetSceneItemEnabled", {
            sceneName,
            sceneItemId,
            sceneItemEnabled: true
        });

        await this.obsClient.call("SetSceneItemTransform", {
            sceneName,
            sceneItemId,
            sceneItemTransform: {
                positionX: 0,
                positionY: 0,
                boundsType: "OBS_BOUNDS_STRETCH",
                boundsWidth: LIVEHUB_CANVAS_WIDTH,
                boundsHeight: LIVEHUB_CANVAS_HEIGHT,
                alignment: 5
            }
        });
    }

    async refreshBrowserSource(inputName) {
        await this.obsClient.call("PressInputPropertiesButton", {
            inputName,
            propertyName: "refreshnocache"
        });
    }

    async writeOverlayHtml(sceneIds, hub, initialValues, initialPreview) {
        const filePath = getOverlayFilePath(sceneIds);
        const html = createLiveHubOverlayHtml({
            hub,
            userId: sceneIds.userId,
            hubId: sceneIds.hubId,
            backendUrl: this.hubApi.baseUrl,
            eventName: LIVEHUB_BROWSER_EVENT_NAME,
            initialValues,
            initialPreview
        });

        await writeTextFile(filePath, html);

        return filePath;
    }

    async flushRenderQueue() {
        this.rendering = true;

        try {
            while (this.pendingState) {
                const state = this.pendingState;
                this.pendingState = null;
                await this.renderNow(state);
            }
        }
        catch (error) {
            this.prepared = false;
            this.updateStatus({
                state: "error",
                prepared: false,
                message: getErrorMessage(error)
            });
        }
        finally {
            this.rendering = false;
        }
    }

    async renderNow(state) {
        const values = getLeagueRenderValues(state);
        const preview = getLeagueRenderPreview(values);
        const payload = this.createRenderPayload(values, preview);
        const payloadJson = JSON.stringify({ values, preview });
        let message = "OBS browser source already current.";

        if (this.lastRenderPayloadJson !== payloadJson) {
            await this.sendOverlayEvent(payload);
            this.lastRenderPayloadJson = payloadJson;
            message = "OBS browser source updated.";
        }

        this.updateStatus({
            state: "ready",
            prepared: true,
            preview,
            message
        });
    }

    createRenderPayload(values, preview) {
        return {
            type: LIVEHUB_BROWSER_EVENT_NAME,
            userId: this.status.userId,
            hubId: this.status.hubId,
            values,
            preview,
            updatedAt: new Date().toISOString()
        };
    }

    async sendOverlayEvent(payload) {
        await this.obsClient.call("CallVendorRequest", {
            vendorName: "obs-browser",
            requestType: "emit_event",
            requestData: {
                event_name: LIVEHUB_BROWSER_EVENT_NAME,
                event_data: payload
            }
        });
    }

    updateStatus(changes) {
        this.status = {
            ...this.status,
            ...changes,
            updatedAt: new Date().toISOString()
        };
        this.onStatus(this.getStatus());
    }
}

function createStatusLayer(target) {
    return {
        type: target.type,
        team: target.team,
        role: target.role,
        layerId: target.layer.id
    };
}

function getReadyMessage(layerCount) {
    if (layerCount === 0) {
        return "Ready with one OBS browser source. No live stat layers found.";
    }

    return `Ready to update one OBS browser source with ${layerCount} live layer${layerCount === 1 ? "" : "s"}.`;
}

function parseLiveHubSceneName(sceneName) {
    const userId = readSceneValue(sceneName, "userId");
    const hubId = readSceneValue(sceneName, "hubId");

    if (!userId || !hubId) {
        throw new Error("Current OBS scene is not a LiveHub scene.");
    }

    return { userId, hubId };
}

function readSceneValue(sceneName, key) {
    const match = new RegExp(`${key}=([^\\s]+)`).exec(sceneName);
    return match ? match[1] : null;
}

function getHubLayers(hub) {
    if (hub && Array.isArray(hub.layers)) {
        return hub.layers;
    }
    if (hub && hub.layout && Array.isArray(hub.layout.layers)) {
        return hub.layout.layers;
    }
    return [];
}

function getLiveHubBrowserSourceName(sceneIds) {
    return `LiveHub Overlay ${sceneIds.hubId}`;
}

function getBrowserSourceInputSettings(filePath) {
    return {
        is_local_file: true,
        local_file: filePath,
        width: LIVEHUB_CANVAS_WIDTH,
        height: LIVEHUB_CANVAS_HEIGHT,
        fps_custom: true,
        fps: 60,
        css: "html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; }",
        shutdown: false,
        restart_when_active: false
    };
}

function getOverlayFilePath(sceneIds) {
    const rootPath = getOverwolfWritableRoot();
    const fileName = `livehub-${safeFilePart(sceneIds.userId)}-${safeFilePart(sceneIds.hubId)}.html`;

    return normalizePath(`${rootPath}/${LIVEHUB_OVERLAY_FOLDER}/${fileName}`);
}

function getOverwolfWritableRoot() {
    const paths = window.overwolf && overwolf.io && overwolf.io.paths;
    const rootPath = paths && (paths.localAppData || paths.documents || paths.userRoot);

    if (!rootPath) {
        throw new Error("Overwolf local app data path is unavailable.");
    }

    return rootPath;
}

function writeTextFile(filePath, content) {
    return new Promise((resolve, reject) => {
        if (!window.overwolf || !overwolf.io || !overwolf.io.writeFileContents) {
            reject(new Error("Overwolf FileSystem API is unavailable."));
            return;
        }

        const encoding = getUtf8Encoding();

        overwolf.io.writeFileContents(filePath, content, encoding, false, (result) => {
            if (result && (result.success || result.status === "success")) {
                resolve();
                return;
            }

            reject(new Error(`Could not write OBS overlay HTML file. ${result && result.error ? result.error : ""}`.trim()));
        });
    });
}

function getUtf8Encoding() {
    if (
        window.overwolf &&
        overwolf.io &&
        overwolf.io.enums &&
        overwolf.io.enums.eEncoding &&
        overwolf.io.enums.eEncoding.UTF8
    ) {
        return overwolf.io.enums.eEncoding.UTF8;
    }

    return "UTF8";
}

function createLiveHubOverlayHtml(options) {
    const values = options.initialValues || getLeagueRenderValues(null);
    const preview = options.initialPreview || getLeagueRenderPreview(values);
    const payload = {
        eventName: options.eventName,
        canvas: {
            width: LIVEHUB_CANVAS_WIDTH,
            height: LIVEHUB_CANVAS_HEIGHT
        },
        userId: options.userId,
        hubId: options.hubId,
        hubName: options.hub && options.hub.hubName ? options.hub.hubName : options.hubId,
        values,
        preview,
        layers: getOverlayLayers(options.hub, options.backendUrl),
        generatedAt: new Date().toISOString()
    };

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=1920, height=1080, initial-scale=1">
  <title>LiveHub OBS Overlay</title>
  <style>
    html,
    body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: transparent;
    }

    body {
      font-family: Arial, sans-serif;
    }

    #stage {
      position: relative;
      width: 1920px;
      height: 1080px;
      overflow: hidden;
      background: transparent;
      color: #ffffff;
    }

    .layer {
      position: absolute;
      display: grid;
      place-items: center;
      overflow: hidden;
      box-sizing: border-box;
      container-type: inline-size;
    }

    .text-content,
    .stat-content {
      overflow: hidden;
      max-width: 100%;
      max-height: 100%;
      line-height: 1.15;
      text-align: center;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .stat-content {
      color: #ffffff;
      font-family: Arial, sans-serif;
      font-size: 48px;
      font-weight: 400;
    }

    .scorebug,
    .player-roster,
    .items-layer,
    .champion-portrait {
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      box-sizing: border-box;
      color: inherit;
      font-family: Arial, sans-serif;
    }

    .scorebug {
      display: grid;
      grid-template:
        "blue center red" minmax(0, 1fr)
        "blue-objectives center red-objectives" 26% / minmax(0, 1fr) minmax(24%, 0.42fr) minmax(0, 1fr);
      background: linear-gradient(90deg, var(--blue-accent, #34d5e6), rgb(18 19 42 / 94%) 34%, rgb(18 19 42 / 96%) 66%, var(--red-accent, #ef7d24));
      text-transform: uppercase;
    }

    .scorebug-team,
    .scorebug-center,
    .objective-row {
      display: flex;
      align-items: center;
      min-width: 0;
    }

    .scorebug-team {
      gap: 4.8%;
      padding: 0 4.8%;
    }

    .scorebug-team-blue {
      grid-area: blue;
      justify-content: flex-start;
    }

    .scorebug-team-red {
      grid-area: red;
      justify-content: flex-end;
    }

    .scorebug-center {
      position: relative;
      grid-area: center;
      justify-content: center;
      gap: 26px;
      background: rgb(8 9 24 / 82%);
      box-shadow: 0 0 0 1px rgb(255 255 255 / 10%) inset;
    }

    .team-code,
    .team-kills {
      font-weight: 950;
      line-height: 1;
      white-space: nowrap;
    }

    .team-logo {
      display: grid;
      flex: 0 0 auto;
      width: 46px;
      height: 46px;
      place-items: center;
      border: 1px solid rgb(255 255 255 / 32%);
      background: rgb(255 255 255 / 14%);
      font-size: 17px;
      font-weight: 950;
    }

    .team-lockup {
      display: grid;
      min-width: 0;
      gap: 2px;
    }

    .scorebug-team-red .team-lockup {
      text-align: right;
    }

    .team-seed {
      font-size: 10px;
      font-weight: 850;
      opacity: .78;
      white-space: nowrap;
    }

    .team-objective {
      font-size: 13px;
      font-weight: 950;
      white-space: nowrap;
    }

    .team-code {
      overflow: hidden;
      font-size: 34px;
      text-overflow: ellipsis;
    }

    .team-gold {
      font-size: 16px;
      font-weight: 850;
      opacity: 0.92;
      white-space: nowrap;
    }

    .team-kills {
      min-width: 42px;
      font-size: 36px;
      text-align: center;
    }

    .score-divider {
      width: 58px;
      height: 2px;
      background: rgb(255 255 255 / 34%);
    }

    .game-clock {
      position: absolute;
      bottom: 22%;
      left: 50%;
      padding: 2px 8px;
      background: rgb(0 0 0 / 52%);
      color: #fff;
      font-size: 13px;
      font-weight: 850;
      transform: translateX(-50%);
    }

    .objective-row {
      gap: 18px;
      padding: 0 28px;
      background: rgb(4 5 12 / 78%);
      font-size: 12px;
      font-weight: 850;
      opacity: 0.88;
    }

    .objective-row-blue {
      grid-area: blue-objectives;
      justify-content: flex-start;
    }

    .objective-row-red {
      grid-area: red-objectives;
      justify-content: flex-end;
    }

    .player-roster {
      display: grid;
      grid-template-rows: repeat(5, minmax(0, 1fr));
      gap: 5px;
      padding: 4px;
      background: rgb(8 10 16 / 68%);
    }

    .roster-row {
      display: grid;
      align-items: center;
      grid-template-columns: 42px 28px minmax(0, 1.3fr) 68px 42px 54px minmax(0, 1.8fr);
      gap: 6px;
      min-width: 0;
      overflow: hidden;
      padding: 3px 7px;
      background: linear-gradient(90deg, rgb(255 255 255 / 10%), rgb(255 255 255 / 3%));
    }

    .player-roster-right .roster-row {
      direction: ltr;
    }

    .player-roster-right .roster-name,
    .player-roster-right .roster-kda,
    .player-roster-right .roster-stat,
    .player-roster-right .roster-items {
      direction: ltr;
    }

    .roster-portrait,
    .roster-level,
    .item-slot,
    .portrait-level {
      display: grid;
      place-items: center;
    }

    .roster-portrait {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: rgb(255 255 255 / 10%);
    }

    .roster-portrait img,
    .champion-portrait img,
    .item-slot img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .roster-portrait img {
      object-fit: contain;
    }

    .roster-name {
      overflow: hidden;
      font-size: 16px;
      font-weight: 880;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .roster-level,
    .roster-stat,
    .roster-kda {
      font-size: 13px;
      font-weight: 850;
      white-space: nowrap;
    }

    .roster-items,
    .items-layer {
      display: grid;
      min-width: 0;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 3px;
    }

    .items-layer {
      grid-template-columns: repeat(6, minmax(0, 1fr)) minmax(0, 1fr);
      align-items: center;
    }

    .item-slot {
      aspect-ratio: 1;
      min-width: 0;
      overflow: hidden;
      border: 1px solid rgb(255 255 255 / 18%);
      background: rgb(0 0 0 / 34%);
    }

    .trinket-slot {
      border-color: rgb(113 209 255 / 58%);
    }

    .champion-portrait {
      position: relative;
      background: rgb(7 8 14 / 88%);
    }

    .champion-portrait-circle {
      border-radius: 999px;
    }

    .champion-portrait-banner img {
      object-position: center 18%;
    }

    .portrait-level {
      position: absolute;
      right: 0;
      bottom: 0;
      min-width: 28%;
      height: 28%;
      background: rgb(0 0 0 / 78%);
      color: #fff;
      font-size: 20px;
      font-weight: 950;
    }

    .media {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .placeholder {
      display: grid;
      width: 100%;
      height: 100%;
      place-items: center;
      color: #ffffff;
      font: 700 24px/1.2 Arial, sans-serif;
      text-align: center;
    }
  </style>
</head>
<body>
  <div id="stage"></div>
  <script>
    window.__LIVEHUB_OVERLAY__ = ${toScriptJson(payload)};
  </script>
  <script>
    (function () {
      "use strict";

      var config = window.__LIVEHUB_OVERLAY__ || {};
      var currentValues = config.values || {};
      var stage = document.getElementById("stage");

      function build() {
        if (!stage) {
          return;
        }

        stage.textContent = "";
        installCustomStyle();
        var layers = config.layers || [];
        layers.forEach(function (layer, index) {
          stage.appendChild(createLayerElement(layer, index, layers.length));
        });
        updateDynamicLayers();
      }

      function installCustomStyle() {
        var style = document.createElement("style");
        style.textContent = createScopedLayerCss(config.layers || []);
        stage.appendChild(style);
      }

      function createLayerElement(layer, index, layerCount) {
        var element = document.createElement("div");
        var width = positiveNumber(layer.width, 1);
        var height = positiveNumber(layer.height, 1);
        var position = layer.position || {};

        element.className = "layer layer-" + normalizeClassName(layer.type);
        element.dataset.layerId = layer.id || "";
        element.style.left = px(numberOr(position.x, 0) - width / 2);
        element.style.top = px(numberOr(position.y, 0) - height / 2);
        element.style.width = px(width);
        element.style.height = px(height);
        element.style.zIndex = String(layerCount - index);
        applyLayerStyle(element, layer.style);

        if (layer.type === "Text") {
          element.appendChild(createTextLayer(layer));
          return element;
        }

        if (layer.type === "Shape") {
          return element;
        }

        if (layer.type === "Image") {
          element.appendChild(createImageLayer(layer));
          return element;
        }

        if (layer.type === "Video") {
          element.appendChild(createVideoLayer(layer));
          return element;
        }

        element.appendChild(createDynamicLayer(layer));
        return element;
      }

      function createTextLayer(layer) {
        var span = document.createElement("span");
        span.className = "text-content";
        span.textContent = layer.text || "";
        span.style.color = layer.color || "#ffffff";
        span.style.fontFamily = layer.fontFamily || "Arial";
        span.style.fontSize = px(positiveNumber(layer.fontSize, 32));
        span.style.fontWeight = String(layer.fontWeight || (layer.bold ? "700" : "400"));
        span.style.letterSpacing = px(numberOr(layer.letterSpacing, 0));
        span.style.textAlign = layer.textAlign || "center";
        span.style.lineHeight = String(numberOr(layer.lineHeight, 1.15));
        span.style.textTransform = layer.uppercase ? "uppercase" : "none";
        return span;
      }

      function createImageLayer(layer) {
        if (!layer.src) {
          return createPlaceholder(layer.name);
        }

        var image = document.createElement("img");
        image.className = "media";
        image.src = layer.src;
        image.alt = layer.alt || layer.name || "";
        image.style.opacity = String(clamp(numberOr(layer.opacity, 100) / 100, 0, 1));
        image.style.objectFit = layer.fit || "cover";
        image.style.objectPosition = layer.objectPosition || "center";
        return image;
      }

      function createVideoLayer(layer) {
        if (!layer.src) {
          return createPlaceholder(layer.name);
        }

        var video = document.createElement("video");
        video.className = "media";
        video.src = layer.src;
        video.autoplay = layer.autoplay !== false;
        video.muted = layer.muted !== false;
        video.loop = true;
        video.playsInline = true;
        video.style.objectFit = layer.fit || "cover";
        video.style.objectPosition = layer.objectPosition || "center";
        return video;
      }

      function createDynamicLayer(layer) {
        var element = document.createElement("div");
        element.className = getDynamicLayerClassName(layer);
        element.dataset.livehubDynamic = "true";
        element.dataset.layerId = layer.id || "";
        renderDynamicLayer(element, layer);
        return element;
      }

      function createPlaceholder(text) {
        var span = document.createElement("span");
        span.className = "placeholder";
        span.textContent = text || "";
        return span;
      }

      function updateDynamicLayers() {
        var elements = document.querySelectorAll("[data-livehub-dynamic='true']");
        elements.forEach(function (element) {
          var layer = getLayerConfig(element.dataset.layerId);
          if (layer) {
            renderDynamicLayer(element, layer);
          }
        });
      }

      function renderDynamicLayer(element, layer) {
        element.textContent = "";

        if (layer.type === "LolScorebug") {
          element.appendChild(createScorebug(layer));
          return;
        }

        if (layer.type === "LolPlayerRoster") {
          element.appendChild(createPlayerRoster(layer));
          return;
        }

        if (layer.type === "PlayerItems") {
          element.appendChild(createItemsLayer(layer));
          return;
        }

        if (layer.type === "ChampionPortrait") {
          element.appendChild(createChampionPortrait(layer));
          return;
        }

        element.textContent = getDynamicText(layer);
      }

      function createScorebug(layer) {
        var scorebug = document.createElement("div");
        scorebug.className = "scorebug";
        scorebug.style.setProperty("--blue-accent", layer.blueAccent || "#34d5e6");
        scorebug.style.setProperty("--red-accent", layer.redAccent || "#ef7d24");
        scorebug.appendChild(createScorebugTeam("blue", layer));
        scorebug.appendChild(createScorebugCenter(layer));
        scorebug.appendChild(createScorebugTeam("red", layer));

        if (layer.showObjectives !== false) {
          scorebug.appendChild(createObjectiveRow("blue", layer));
          scorebug.appendChild(createObjectiveRow("red", layer));
        }

        return scorebug;
      }

      function createScorebugTeam(team, layer) {
        var element = document.createElement("div");
        var logo = document.createElement("span");
        var lockup = document.createElement("span");
        var code = document.createElement("span");
        var seed = document.createElement("span");
        var gold = document.createElement("span");
        var tower = document.createElement("span");
        var teamStats = layer.teamStats && layer.teamStats[team] || {};

        element.className = "scorebug-team scorebug-team-" + team;
        logo.className = "team-logo";
        logo.textContent = String(team === "red" ? layer.redTeamCode : layer.blueTeamCode).slice(0, 2);
        lockup.className = "team-lockup";
        code.className = "team-code";
        code.textContent = team === "red"
          ? valueOr(layer.redTeamCode, "RED")
          : valueOr(layer.blueTeamCode, "BLUE");
        seed.className = "team-seed";
        seed.textContent = valueOr(teamStats.seed, team === "red" ? "Seed #6" : "Seed #1");
        lockup.appendChild(code);
        lockup.appendChild(seed);
        gold.className = "team-gold";
        gold.textContent = teamStats.gold !== undefined
          ? (Number(teamStats.gold) / 1000).toFixed(1) + "K"
          : valueOr(currentValues.teamGold && currentValues.teamGold[team], "0.0K");
        tower.className = "team-objective";
        tower.textContent = "T" + valueOr(teamStats.towers, valueOr(currentValues.towers && currentValues.towers[team], "0"));

        if (team === "red") {
          if (layer.showObjectives !== false) element.appendChild(tower);
          if (layer.showGold !== false) element.appendChild(gold);
          element.appendChild(lockup);
          element.appendChild(logo);
        }
        else {
          element.appendChild(logo);
          element.appendChild(lockup);
          if (layer.showGold !== false) element.appendChild(gold);
          if (layer.showObjectives !== false) element.appendChild(tower);
        }
        return element;
      }

      function createScorebugCenter(layer) {
        var element = document.createElement("div");
        var blueKills = document.createElement("span");
        var divider = document.createElement("span");
        var redKills = document.createElement("span");

        element.className = "scorebug-center";
        blueKills.className = "team-kills";
        blueKills.textContent = valueOr(layer.teamStats && layer.teamStats.blue && layer.teamStats.blue.kills, valueOr(currentValues.kills && currentValues.kills.blue, "0"));
        divider.className = "score-divider";
        redKills.className = "team-kills";
        redKills.textContent = valueOr(layer.teamStats && layer.teamStats.red && layer.teamStats.red.kills, valueOr(currentValues.kills && currentValues.kills.red, "0"));
        element.appendChild(blueKills);
        element.appendChild(divider);
        element.appendChild(redKills);

        if (layer.showGameTime !== false) {
          var clock = document.createElement("span");
          clock.className = "game-clock";
          clock.textContent = valueOr(layer.gameTime, valueOr(currentValues.time, "00:00"));
          element.appendChild(clock);
        }

        return element;
      }

      function createObjectiveRow(team, layer) {
        var element = document.createElement("div");
        var stats = layer.teamStats && layer.teamStats[team] || {};
        var values = team === "red"
          ? [
            "VG" + valueOr(stats.voidGrubs, valueOr(currentValues.voidGrubs && currentValues.voidGrubs[team], "0")),
            "DR " + valueOr(stats.dragons, valueOr(currentValues.dragon && currentValues.dragon[team], "0")),
            "H " + valueOr(stats.riftHerald, valueOr(currentValues.riftHerald && currentValues.riftHerald[team], "0"))
          ]
          : [
            "DR " + valueOr(stats.dragons, valueOr(currentValues.dragon && currentValues.dragon[team], "0")),
            "VG" + valueOr(stats.voidGrubs, valueOr(currentValues.voidGrubs && currentValues.voidGrubs[team], "0")),
            "H " + valueOr(stats.riftHerald, valueOr(currentValues.riftHerald && currentValues.riftHerald[team], "0"))
          ];

        element.className = "objective-row objective-row-" + team;
        values.forEach(function (value) {
          var span = document.createElement("span");
          span.textContent = value;
          element.appendChild(span);
        });

        return element;
      }

      function createPlayerRoster(layer) {
        var roster = document.createElement("div");
        var team = normalizeTeam(layer.team);
        var roles = ["top", "jungle", "mid", "adc", "support"];

        roster.className = "player-roster" + (layer.orientation === "right" ? " player-roster-right" : "");
        roles.forEach(function (role) {
          var override = layer.playerOverrides && layer.playerOverrides[role] || {};
          if (override.visible === false) return;
          roster.appendChild(createRosterRow(applyRosterOverride(getPlayerValue(team, role), override), layer));
        });

        return roster;
      }

      function createRosterRow(player, layer) {
        var row = document.createElement("div");
        row.className = "roster-row";

        if (layer.orientation === "right") {
          appendRosterKda(row, player, layer);
          appendRosterCs(row, player, layer);
          appendRosterGold(row, player, layer);
          appendRosterName(row, player);
          appendRosterLevel(row, player, layer);
          appendRosterChampion(row, player, layer);
          appendRosterItems(row, player, layer);
        }
        else {
          appendRosterItems(row, player, layer);
          appendRosterChampion(row, player, layer);
          appendRosterLevel(row, player, layer);
          appendRosterName(row, player);
          appendRosterCs(row, player, layer);
          appendRosterGold(row, player, layer);
          appendRosterKda(row, player, layer);
        }

        return row;
      }

      function appendRosterChampion(row, player, layer) {
        if (layer.showChampion !== false) {
          row.appendChild(createChampionImageBox(player, "roster-portrait"));
        }
      }

      function appendRosterLevel(row, player, layer) {
        if (layer.showLevel !== false) {
          row.appendChild(createTextBox("roster-level", player.level));
        }
      }

      function appendRosterName(row, player) {
        row.appendChild(createTextBox("roster-name", player.name));
      }

      function appendRosterKda(row, player, layer) {
        if (layer.showKda !== false) {
          row.appendChild(createTextBox("roster-kda", player.score));
        }
      }

      function appendRosterCs(row, player, layer) {
        if (layer.showCs !== false) {
          row.appendChild(createTextBox("roster-stat", player.creepScore));
        }
      }

      function appendRosterGold(row, player, layer) {
        if (layer.showGold === true) {
          row.appendChild(createTextBox("roster-stat", player.gold));
        }
      }

      function appendRosterItems(row, player, layer) {
        if (layer.showItems !== false) {
          var items = createItemSlots(player.items || [], false);
          items.className = "roster-items";
          row.appendChild(items);
        }
      }

      function applyRosterOverride(player, override) {
        var score = String(player.score || "0/0/0").split("/");
        return Object.assign({}, player, override, {
          score: [
            valueOr(override.kills, score[0] || "0"),
            valueOr(override.deaths, score[1] || "0"),
            valueOr(override.assists, score[2] || "0")
          ].join("/"),
          items: override.items
            ? override.items.map(function (id) { return id ? { id: id, name: "Item " + id } : null; })
            : player.items
        });
      }

      function createItemsLayer(layer) {
        var player = getPlayerValue(normalizeTeam(layer.team), normalizeRole(layer.role));
        return createItemSlots(player.items || [], layer.showTrinket !== false ? player.trinket : false);
      }

      function createItemSlots(items, trinket) {
        var element = document.createElement("div");
        element.className = "items-layer";
        items.slice(0, 6).forEach(function (item) {
          element.appendChild(createItemSlot(item, false));
        });
        while (element.children.length < 6) {
          element.appendChild(createItemSlot(null, false));
        }
        if (trinket !== false) {
          element.appendChild(createItemSlot(trinket, true));
        }
        return element;
      }

      function createItemSlot(item, isTrinket) {
        var slot = document.createElement("span");
        slot.className = "item-slot" + (isTrinket ? " trinket-slot" : "");
        if (item && item.id) {
          var image = document.createElement("img");
          image.src = getItemImageUrl(item.id);
          image.alt = item.name || "Item";
          slot.appendChild(image);
        }
        return slot;
      }

      function createChampionPortrait(layer) {
        var player = getPlayerValue(normalizeTeam(layer.team), normalizeRole(layer.role));
        var element = createChampionImageBox(player, "champion-portrait champion-portrait-" + (layer.shape || "square"));
        if (layer.showLevel !== false) {
          var level = document.createElement("span");
          level.className = "portrait-level";
          level.textContent = valueOr(player.level, "1");
          element.appendChild(level);
        }
        return element;
      }

      function createChampionImageBox(player, className) {
        var box = document.createElement("span");
        var image = document.createElement("img");
        box.className = className;
        image.src = player.championImageUrl || getChampionImageUrl(player.championId || player.championName);
        image.alt = player.championName || "Champion";
        box.appendChild(image);
        return box;
      }

      function createTextBox(className, text) {
        var element = document.createElement("span");
        element.className = className;
        element.textContent = valueOr(text, "");
        return element;
      }

      function getDynamicText(layer) {
        var team = normalizeTeam(layer.team);
        var role = normalizeRole(layer.role);

        if (layer.type === "Time") {
          return valueOr(currentValues.time, "00:00");
        }

        if (layer.type === "PlayerScore") {
          return valueOr(currentValues.playerScores && currentValues.playerScores[team] && currentValues.playerScores[team][role], "0/0/0");
        }

        if (layer.type === "PlayerCreepScore") {
          return valueOr(getPlayerValue(team, role).creepScore, "0");
        }

        if (layer.type === "PlayerGold") {
          return valueOr(getPlayerValue(team, role).gold, "0.0K");
        }

        if (layer.type === "PlayerName") {
          return valueOr(getPlayerValue(team, role).name, "");
        }

        if (layer.type === "PlayerLevel") {
          return valueOr(getPlayerValue(team, role).level, "1");
        }

        if (layer.type === "ChampionName") {
          return valueOr(getPlayerValue(team, role).championName, "");
        }

        if (layer.type === "TeamGold") {
          return valueOr(currentValues.teamGold && currentValues.teamGold[team], "0.0K");
        }

        if (layer.type === "GoldDiff") {
          return valueOr(currentValues.goldDiff, "0.0K");
        }

        if (layer.type === "Kills") {
          return valueOr(currentValues.kills && currentValues.kills[team], layer.name || "0");
        }

        if (layer.type === "Towers") {
          return valueOr(currentValues.towers && currentValues.towers[team], layer.name || "0");
        }

        if (layer.type === "VoidGrubs") {
          return valueOr(currentValues.voidGrubs && currentValues.voidGrubs[team], layer.name || "0");
        }

        if (layer.type === "RiftHerald") {
          return valueOr(currentValues.riftHerald && currentValues.riftHerald[team], layer.name || "0");
        }

        if (layer.type === "Dragon") {
          return valueOr(currentValues.dragon && currentValues.dragon[team], layer.name || "0");
        }

        return layer.name || "";
      }

      function handleRenderEvent(event) {
        var payload = unwrapPayload(event && event.detail);

        if (!payload || !payload.values) {
          return;
        }

        if (payload.hubId && config.hubId && payload.hubId !== config.hubId) {
          return;
        }

        if (payload.userId && config.userId && payload.userId !== config.userId) {
          return;
        }

        currentValues = payload.values;
        updateDynamicLayers();
      }

      function unwrapPayload(detail) {
        if (!detail) {
          return null;
        }

        if (detail.values) {
          return detail;
        }

        if (detail.event_data && detail.event_data.values) {
          return detail.event_data;
        }

        if (detail.eventData && detail.eventData.values) {
          return detail.eventData;
        }

        if (detail.data && detail.data.values) {
          return detail.data;
        }

        return null;
      }

      function getLayerConfig(layerId) {
        return (config.layers || []).find(function (layer) {
          return String(layer.id || "") === String(layerId || "");
        }) || null;
      }

      function getDynamicLayerClassName(layer) {
        if (layer.type === "LolScorebug") {
          return "scorebug-shell";
        }
        if (layer.type === "LolPlayerRoster") {
          return "player-roster-shell";
        }
        if (layer.type === "PlayerItems") {
          return "items-shell";
        }
        if (layer.type === "ChampionPortrait") {
          return "champion-portrait-shell";
        }
        return "stat-content";
      }

      function getPlayerValue(team, role) {
        var players = currentValues.players || {};
        var teamPlayers = players[normalizeTeam(team)] || {};
        return teamPlayers[normalizeRole(role)] || createEmptyPlayerValue();
      }

      function createEmptyPlayerValue() {
        return {
          name: "",
          championName: "",
          championId: "",
          level: "1",
          score: "0/0/0",
          creepScore: "0",
          gold: "0.0K",
          items: [],
          trinket: null
        };
      }

      function getChampionImageUrl(value) {
        var championId = normalizeChampionId(value);
        return "https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/" + encodeURIComponent(championId || "Aatrox") + ".png";
      }

      function getItemImageUrl(itemId) {
        return "https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/" + encodeURIComponent(String(itemId)) + ".png";
      }

      function normalizeChampionId(value) {
        var compact = String(value || "").replace(/^game_character_displayname_/i, "").replace(/[^a-z0-9]/gi, "");
        var aliases = {
          kaisa: "Kaisa",
          ksante: "KSante",
          leesin: "LeeSin",
          masteryi: "MasterYi",
          missfortune: "MissFortune",
          monkeyking: "MonkeyKing",
          twistedfate: "TwistedFate",
          xinzhao: "XinZhao"
        };
        return aliases[compact.toLowerCase()] || compact;
      }

      function applyLayerStyle(element, style) {
        if (!style) {
          return;
        }
        if (style.backgroundColor) {
          element.style.background = style.backgroundColor;
        }
        if (style.color) {
          element.style.color = style.color;
        }
        if (style.opacity !== undefined) {
          element.style.opacity = String(clamp(numberOr(style.opacity, 100) / 100, 0, 1));
        }
        if (style.borderColor) {
          element.style.borderColor = style.borderColor;
        }
        if (numberOr(style.borderWidth, 0) > 0) {
          element.style.borderStyle = "solid";
          element.style.borderWidth = px(numberOr(style.borderWidth, 0));
        }
        if (style.borderRadius !== undefined) {
          element.style.borderRadius = px(numberOr(style.borderRadius, 0));
        }
        if (style.padding !== undefined) {
          element.style.padding = px(numberOr(style.padding, 0));
        }
        if (style.boxShadow) {
          element.style.boxShadow = style.boxShadow;
        }
        if (style.textShadow) {
          element.style.textShadow = style.textShadow;
        }
      }

      function createScopedLayerCss(layers) {
        return layers.map(function (layer) {
          return createLayerCss(layer.id, layer.style && layer.style.customCss);
        }).filter(Boolean).join("\\n");
      }

      function createLayerCss(layerId, customCss) {
        var css = String(customCss || "").replace(/<\\/?style[^>]*>/gi, "").trim();
        var attribute = "[data-layer-id=\\"" + cssEscape(layerId) + "\\"]";
        var scope = attribute + attribute;

        if (!css) {
          return "";
        }

        if (css.indexOf("{") === -1) {
          return scope + " { " + css + " }";
        }

        return css.replace(/([^{}]+)\\{/g, function (match, selectorText) {
          var selectors = selectorText.split(",").map(function (selector) {
            selector = selector.trim();
            if (!selector || selector.charAt(0) === "@") {
              return "";
            }
            return selector.indexOf("&") >= 0
              ? selector.replace(/&/g, scope)
              : scope + " " + selector;
          }).filter(Boolean);

          return selectors.length ? selectors.join(", ") + " {" : match;
        });
      }

      function cssEscape(value) {
        return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
      }

      function normalizeClassName(value) {
        return String(value || "unknown").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      }

      function normalizeTeam(value) {
        return String(value || "").toLowerCase() === "red" ? "red" : "blue";
      }

      function normalizeRole(value) {
        var role = String(value || "").toLowerCase();

        return role || "top";
      }

      function valueOr(value, fallback) {
        if (value === undefined || value === null || value === "") {
          return fallback;
        }

        return String(value);
      }

      function px(value) {
        return String(Math.round(Number(value) || 0)) + "px";
      }

      function numberOr(value, fallback) {
        var number = Number(value);
        return Number.isFinite(number) ? number : fallback;
      }

      function positiveNumber(value, fallback) {
        return Math.max(1, numberOr(value, fallback));
      }

      function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }

      window.addEventListener(config.eventName || "livehub-render-state", handleRenderEvent);
      window.addEventListener("obsSourceCustomEvent", handleRenderEvent);
      build();
    })();
  </script>
</body>
</html>`;
}

function getOverlayLayers(hub, backendUrl) {
    return getHubLayers(hub)
        .filter((layer) => layer && layer.visible !== false && String(layer.type || "") !== "Group")
        .map((layer) => createOverlayLayer(layer, backendUrl));
}

function createOverlayLayer(layer, backendUrl) {
    const overlayLayer = {
        id: String(layer.id || ""),
        name: String(layer.name || ""),
        type: String(layer.type || ""),
        visible: layer.visible !== false,
        position: {
            x: Number(layer.position && layer.position.x) || 0,
            y: Number(layer.position && layer.position.y) || 0
        },
        width: Math.max(1, Number(layer.width) || 1),
        height: Math.max(1, Number(layer.height) || 1),
        style: sanitizeLayerStyle(layer.style)
    };

    if (overlayLayer.type === "Text") {
        return {
            ...overlayLayer,
            text: String(layer.text || ""),
            fontSize: Math.max(1, Number(layer.fontSize) || 32),
            fontFamily: String(layer.fontFamily || "Arial"),
            bold: Boolean(layer.bold),
            color: String(layer.color || "#ffffff"),
            fontWeight: Math.max(1, Number(layer.fontWeight) || (layer.bold ? 700 : 400)),
            letterSpacing: Number(layer.letterSpacing) || 0,
            textAlign: String(layer.textAlign || "center"),
            lineHeight: Number(layer.lineHeight) || 1.15,
            uppercase: Boolean(layer.uppercase)
        };
    }

    if (overlayLayer.type === "Image") {
        return {
            ...overlayLayer,
            src: resolveMediaUrl(layer.src || layer.localFilePath, backendUrl),
            alt: String(layer.alt || layer.name || ""),
            opacity: Number.isFinite(Number(layer.opacity)) ? Number(layer.opacity) : 100,
            fit: String(layer.fit || "cover"),
            objectPosition: String(layer.objectPosition || "center")
        };
    }

    if (overlayLayer.type === "Video") {
        return {
            ...overlayLayer,
            src: resolveMediaUrl(layer.src || layer.localFilePath, backendUrl),
            autoplay: layer.autoplay !== false,
            muted: layer.muted !== false,
            fit: String(layer.fit || "cover"),
            objectPosition: String(layer.objectPosition || "center")
        };
    }

    return {
        ...overlayLayer,
        team: getStatLayerTeam(layer),
        role: getPlayerScoreRole(layer),
        showTrinket: layer.showTrinket !== false,
        shape: String(layer.shape || "square"),
        showLevel: layer.showLevel !== false,
        blueTeamCode: String(layer.blueTeamCode || "BLUE"),
        redTeamCode: String(layer.redTeamCode || "RED"),
        blueAccent: String(layer.blueAccent || "#34d5e6"),
        redAccent: String(layer.redAccent || "#ef7d24"),
        showGold: layer.showGold !== false,
        showObjectives: layer.showObjectives !== false,
        showGameTime: layer.showGameTime !== false,
        gameTime: String(layer.gameTime || ""),
        teamStats: layer.teamStats && typeof layer.teamStats === "object" ? layer.teamStats : null,
        orientation: String(layer.orientation || "left"),
        showChampion: layer.showChampion !== false,
        showKda: layer.showKda !== false,
        showCs: layer.showCs !== false,
        showItems: layer.showItems !== false,
        playerOverrides: layer.playerOverrides && typeof layer.playerOverrides === "object" ? layer.playerOverrides : null
    };
}

function sanitizeLayerStyle(style) {
    if (!style || typeof style !== "object") {
        return null;
    }

    return {
        backgroundColor: stringOrEmpty(style.backgroundColor),
        color: stringOrEmpty(style.color),
        opacity: numberOrNull(style.opacity),
        borderColor: stringOrEmpty(style.borderColor),
        borderWidth: numberOrNull(style.borderWidth),
        borderRadius: numberOrNull(style.borderRadius),
        padding: numberOrNull(style.padding),
        boxShadow: stringOrEmpty(style.boxShadow),
        textShadow: stringOrEmpty(style.textShadow),
        customCss: stringOrEmpty(style.customCss)
    };
}

function stringOrEmpty(value) {
    return value === undefined || value === null ? "" : String(value);
}

function numberOrNull(value) {
    const number = Number(value);

    return Number.isFinite(number) ? number : null;
}

function resolveMediaUrl(value, backendUrl) {
    const source = String(value || "").trim();

    if (!source) {
        return "";
    }

    if (source === "/lol-assets/map11.png") {
        return "https://ddragon.leagueoflegends.com/cdn/14.24.1/img/map/map11.png";
    }

    if (/^(https?:|data:|blob:|file:)/i.test(source)) {
        return source;
    }

    if (/^[a-z]:[\\/]/i.test(source) || /^\\\\/.test(source)) {
        return pathToFileUrl(source);
    }

    if (!backendUrl) {
        return source;
    }

    try {
        return new URL(source, normalizeBackendUrl(backendUrl) + "/").toString();
    }
    catch {
        return source;
    }
}

function normalizeBackendUrl(value) {
    return String(value || "").replace(/\/+$/, "");
}

function pathToFileUrl(value) {
    const normalizedPath = String(value || "").replace(/\\/g, "/");
    const prefixedPath = normalizedPath.startsWith("//")
        ? `file:${normalizedPath}`
        : `file:///${normalizedPath}`;

    return encodeURI(prefixedPath);
}

function normalizePath(value) {
    return String(value || "").replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^([a-z]):/i, "$1:");
}

function safeFilePart(value) {
    return String(value || "unknown").replace(/[^a-z0-9._-]+/gi, "_").slice(0, 96);
}

function toScriptJson(value) {
    return JSON.stringify(value)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}

function isSupportedStatLayer(layer) {
    const type = normalizeStatLayerType(layer.type);
    return Object.values(LEAGUE_RENDER_TYPES).includes(type);
}

function normalizeStatLayerType(type) {
    const normalizedType = String(type || "").trim().toLowerCase();
    const compactType = normalizedType.replace(/[\s_-]+/g, "");

    if (compactType === "kills" || compactType === "killslayer") {
        return LEAGUE_RENDER_TYPES.kills;
    }
    if (
        compactType === "towers" ||
        compactType === "tower" ||
        compactType === "towerlayer" ||
        compactType === "towerslayer"
    ) {
        return LEAGUE_RENDER_TYPES.towers;
    }
    if (compactType === "voidgrubs" || compactType === "voidgrub" || compactType === "horde") {
        return LEAGUE_RENDER_TYPES.voidGrubs;
    }
    if (compactType === "riftherald" || compactType === "herald") {
        return LEAGUE_RENDER_TYPES.riftHerald;
    }
    if (compactType === "dragon" || compactType === "dragons") {
        return LEAGUE_RENDER_TYPES.dragon;
    }
    if (compactType === "teamgold" || compactType === "gold") {
        return LEAGUE_RENDER_TYPES.teamGold;
    }
    if (compactType === "golddiff" || compactType === "golddifference") {
        return LEAGUE_RENDER_TYPES.goldDiff;
    }
    if (
        compactType === "playerscore" ||
        compactType === "playerscores" ||
        compactType === "playerkda" ||
        compactType === "kda"
    ) {
        return LEAGUE_RENDER_TYPES.playerScore;
    }
    if (compactType === "playercreepscore" || compactType === "playercs" || compactType === "cs") {
        return LEAGUE_RENDER_TYPES.playerCreepScore;
    }
    if (compactType === "playergold") {
        return LEAGUE_RENDER_TYPES.playerGold;
    }
    if (compactType === "playeritems" || compactType === "items") {
        return LEAGUE_RENDER_TYPES.playerItems;
    }
    if (compactType === "playername") {
        return LEAGUE_RENDER_TYPES.playerName;
    }
    if (compactType === "playerlevel" || compactType === "level") {
        return LEAGUE_RENDER_TYPES.playerLevel;
    }
    if (compactType === "championname") {
        return LEAGUE_RENDER_TYPES.championName;
    }
    if (compactType === "championportrait" || compactType === "portrait") {
        return LEAGUE_RENDER_TYPES.championPortrait;
    }
    if (compactType === "lolscorebug" || compactType === "scorebug") {
        return LEAGUE_RENDER_TYPES.lolScorebug;
    }
    if (compactType === "lolplayerroster" || compactType === "playerroster" || compactType === "roster") {
        return LEAGUE_RENDER_TYPES.lolPlayerRoster;
    }
    if (compactType === "time" || compactType === "gametime" || compactType === "gameclock") {
        return LEAGUE_RENDER_TYPES.time;
    }

    return String(type || "");
}

function getStatLayerTeam(layer) {
    const type = normalizeStatLayerType(layer.type);

    if (!TEAM_SCOPED_RENDER_TYPES.has(type)) {
        return null;
    }

    const targetText = `${layer.team || ""} ${layer.player || ""} ${layer.playerTarget || ""}`;
    const team = String(targetText).trim().toLowerCase();

    return team.includes("red") ? "red" : "blue";
}

function getPlayerScoreRole(layer) {
    if (!isPlayerRoleLayer(normalizeStatLayerType(layer.type))) {
        return null;
    }

    return normalizePlayerRole(layer.role || layer.playerRole || layer.player || layer.playerTarget) || "top";
}

function isPlayerRoleLayer(type) {
    return (
        type === LEAGUE_RENDER_TYPES.playerScore ||
        type === LEAGUE_RENDER_TYPES.playerCreepScore ||
        type === LEAGUE_RENDER_TYPES.playerGold ||
        type === LEAGUE_RENDER_TYPES.playerItems ||
        type === LEAGUE_RENDER_TYPES.playerName ||
        type === LEAGUE_RENDER_TYPES.playerLevel ||
        type === LEAGUE_RENDER_TYPES.championName ||
        type === LEAGUE_RENDER_TYPES.championPortrait
    );
}

function getLeagueRenderValues(state) {
    const blueTeam = state && state.team && state.team.blue ? state.team.blue : {};
    const redTeam = state && state.team && state.team.red ? state.team.red : {};
    const players = getPlayerValues(state);

    return {
        kills: {
            blue: formatValue(blueTeam.kills),
            red: formatValue(redTeam.kills)
        },
        towers: {
            blue: formatValue(getTowerCount(blueTeam)),
            red: formatValue(getTowerCount(redTeam))
        },
        voidGrubs: {
            blue: formatValue(blueTeam.voidGrubs === undefined ? blueTeam.voidGrub : blueTeam.voidGrubs),
            red: formatValue(redTeam.voidGrubs === undefined ? redTeam.voidGrub : redTeam.voidGrubs)
        },
        riftHerald: {
            blue: formatValue(blueTeam.riftHerald === undefined ? blueTeam.heralds : blueTeam.riftHerald),
            red: formatValue(redTeam.riftHerald === undefined ? redTeam.heralds : redTeam.riftHerald)
        },
        dragon: {
            blue: formatValue(blueTeam.dragons === undefined ? blueTeam.dragon : blueTeam.dragons),
            red: formatValue(redTeam.dragons === undefined ? redTeam.dragon : redTeam.dragons)
        },
        teamGold: {
            blue: formatGold(blueTeam.gold),
            red: formatGold(redTeam.gold)
        },
        goldDiff: formatSignedGold(Number(blueTeam.gold) - Number(redTeam.gold)),
        players,
        playerScores: getPlayerScoreValues(players),
        time: formatGameTime(state && state.game && state.game.time)
    };
}

function getPlayerValues(state) {
    const values = createEmptyPlayerValues();
    const players = state && Array.isArray(state.player) ? state.player : [];
    const usedRoles = {
        blue: new Set(),
        red: new Set()
    };

    players.forEach((player) => {
        const team = getPlayerTeam(player);
        const role = getPlayerRoleWithFallback(player, usedRoles[team]);

        usedRoles[team].add(role);
        values[team][role] = formatPlayerValue(player);
    });

    return values;
}

function getPlayerScoreValues(players) {
    const scores = createEmptyPlayerScoreValues();

    ["blue", "red"].forEach((team) => {
        PLAYER_ROLE_ORDER.forEach((role) => {
            scores[team][role] = players[team][role].score;
        });
    });

    return scores;
}

function createEmptyPlayerValues() {
    return {
        blue: createEmptyRoleValues(createEmptyPlayerValue()),
        red: createEmptyRoleValues(createEmptyPlayerValue())
    };
}

function createEmptyPlayerScoreValues() {
    return {
        blue: createEmptyRoleValues("0/0/0"),
        red: createEmptyRoleValues("0/0/0")
    };
}

function createEmptyRoleValues(defaultValue) {
    return PLAYER_ROLE_ORDER.reduce((values, role) => {
        values[role] = defaultValue;
        return values;
    }, {});
}

function getPlayerTeam(player) {
    const team = String(player && player.team || "").trim().toLowerCase();
    return team === "red" ? "red" : "blue";
}

function getPlayerRoleWithFallback(player, usedRoles) {
    const role = normalizePlayerRole(
        player && (player.role || player.position || player.lane || player.teamPosition)
    );

    if (role && !usedRoles.has(role)) {
        return role;
    }

    return PLAYER_ROLE_ORDER.find((candidate) => !usedRoles.has(candidate)) || PLAYER_ROLE_ORDER[0];
}

function normalizePlayerRole(value) {
    const role = String(value || "").trim().toLowerCase();

    if (role.includes("top")) {
        return "top";
    }
    if (role.includes("jungle")) {
        return "jungle";
    }
    if (role.includes("middle") || role.includes("mid")) {
        return "mid";
    }
    if (role.includes("adc") || role.includes("bottom") || role.includes("bot")) {
        return "adc";
    }
    if (role.includes("support") || role.includes("utility")) {
        return "support";
    }

    return null;
}

function formatPlayerScore(player) {
    return [
        formatValue(player && player.kills),
        formatValue(player && player.deaths),
        formatValue(player && player.assists)
    ].join("/");
}

function formatPlayerValue(player) {
    return {
        name: String(player && player.name || ""),
        championName: String(player && player.championName || ""),
        championId: String(player && (player.championId || player.championName) || ""),
        level: formatValue(player && player.level === undefined ? 1 : player.level),
        score: formatPlayerScore(player),
        creepScore: formatValue(player && (player.creepScore === undefined ? player.minions : player.creepScore)),
        gold: formatGold(player && player.gold),
        items: formatPlayerItems(player),
        trinket: formatTrinket(player)
    };
}

function createEmptyPlayerValue() {
    return {
        name: "",
        championName: "",
        championId: "",
        level: "1",
        score: "0/0/0",
        creepScore: "0",
        gold: "0.0K",
        items: [],
        trinket: null
    };
}

function formatPlayerItems(player) {
    const slots = Array.isArray(player && player.itemSlots)
        ? player.itemSlots
        : Array.isArray(player && player.itemIds)
            ? player.itemIds.map((itemId) => ({ id: itemId, name: `Item ${itemId}` }))
            : [];

    return slots.slice(0, 6).map((item) => ({
        id: Number(item && item.id) || null,
        name: String(item && item.name || "Item")
    }));
}

function formatTrinket(player) {
    if (player && player.trinket && player.trinket.id) {
        return {
            id: Number(player.trinket.id) || null,
            name: String(player.trinket.name || "Trinket")
        };
    }

    const trinket = Array.isArray(player && player.itemSlots)
        ? player.itemSlots.find((item) => isTrinketItemId(item && item.id))
        : null;

    return trinket
        ? {
            id: Number(trinket.id) || null,
            name: String(trinket.name || "Trinket")
        }
        : null;
}

function formatGameTime(value) {
    const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, "0");

    return `${minutes}:${seconds}`;
}

function getLeagueRenderPreview(values) {
    return {
        kills: formatScore(values.kills.blue, values.kills.red),
        towers: formatScore(values.towers.blue, values.towers.red),
        voidGrubs: formatScore(values.voidGrubs.blue, values.voidGrubs.red),
        riftHerald: formatScore(values.riftHerald.blue, values.riftHerald.red),
        dragon: formatScore(values.dragon.blue, values.dragon.red),
        gold: formatScore(values.teamGold.blue, values.teamGold.red),
        goldDiff: values.goldDiff,
        time: values.time
    };
}

function getTowerCount(team) {
    if (Number.isFinite(Number(team.towers))) {
        return Number(team.towers);
    }
    return Number(team.objectives) || 0;
}

function formatValue(value) {
    return String(Number(value) || 0);
}

function formatGold(value) {
    return `${((Number(value) || 0) / 1000).toFixed(1)}K`;
}

function formatSignedGold(value) {
    const number = Number(value) || 0;
    const prefix = number > 0 ? "+" : number < 0 ? "-" : "";

    return `${prefix}${formatGold(Math.abs(number))}`;
}

function formatScore(blueValue, redValue) {
    return `${formatValue(blueValue)} - ${formatValue(redValue)}`;
}

function isTrinketItemId(value) {
    const id = Number(value) || 0;

    return id >= 3330 && id <= 3370;
}

function getErrorMessage(error) {
    return error instanceof Error && error.message
        ? error.message
        : "OBS render failed.";
}
