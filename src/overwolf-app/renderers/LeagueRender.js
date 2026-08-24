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
    playerScore: "PlayerScore",
    time: "Time"
});

const TEAM_SCOPED_RENDER_TYPES = new Set([
    LEAGUE_RENDER_TYPES.kills,
    LEAGUE_RENDER_TYPES.towers,
    LEAGUE_RENDER_TYPES.voidGrubs,
    LEAGUE_RENDER_TYPES.riftHerald,
    LEAGUE_RENDER_TYPES.dragon,
    LEAGUE_RENDER_TYPES.playerScore
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
        (config.layers || []).forEach(function (layer, index) {
          stage.appendChild(createLayerElement(layer, index));
        });
        updateDynamicLayers();
      }

      function createLayerElement(layer, index) {
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
        element.style.zIndex = String(index + 1);

        if (layer.type === "Text") {
          element.appendChild(createTextLayer(layer));
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

        element.appendChild(createStatLayer(layer));
        return element;
      }

      function createTextLayer(layer) {
        var span = document.createElement("span");
        span.className = "text-content";
        span.textContent = layer.text || "";
        span.style.color = layer.color || "#ffffff";
        span.style.fontFamily = layer.fontFamily || "Arial";
        span.style.fontSize = px(positiveNumber(layer.fontSize, 32));
        span.style.fontWeight = layer.bold ? "700" : "400";
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
        return video;
      }

      function createStatLayer(layer) {
        var span = document.createElement("span");
        span.className = "stat-content";
        span.dataset.livehubDynamic = "true";
        span.dataset.layerType = layer.type || "";
        span.dataset.team = normalizeTeam(layer.team);
        span.dataset.role = normalizeRole(layer.role);
        span.textContent = getDynamicText(layer);
        return span;
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
          element.textContent = getDynamicText({
            type: element.dataset.layerType,
            team: element.dataset.team,
            role: element.dataset.role,
            name: element.textContent
          });
        });
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
        height: Math.max(1, Number(layer.height) || 1)
    };

    if (overlayLayer.type === "Text") {
        return {
            ...overlayLayer,
            text: String(layer.text || ""),
            fontSize: Math.max(1, Number(layer.fontSize) || 32),
            fontFamily: String(layer.fontFamily || "Arial"),
            bold: Boolean(layer.bold),
            color: String(layer.color || "#ffffff")
        };
    }

    if (overlayLayer.type === "Image") {
        return {
            ...overlayLayer,
            src: resolveMediaUrl(layer.src || layer.localFilePath, backendUrl),
            alt: String(layer.alt || layer.name || ""),
            opacity: Number.isFinite(Number(layer.opacity)) ? Number(layer.opacity) : 100
        };
    }

    if (overlayLayer.type === "Video") {
        return {
            ...overlayLayer,
            src: resolveMediaUrl(layer.src || layer.localFilePath, backendUrl),
            autoplay: layer.autoplay !== false,
            muted: layer.muted !== false
        };
    }

    return {
        ...overlayLayer,
        team: getStatLayerTeam(layer),
        role: getPlayerScoreRole(layer)
    };
}

function resolveMediaUrl(value, backendUrl) {
    const source = String(value || "").trim();

    if (!source) {
        return "";
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
    if (
        compactType === "playerscore" ||
        compactType === "playerscores" ||
        compactType === "playerkda" ||
        compactType === "kda"
    ) {
        return LEAGUE_RENDER_TYPES.playerScore;
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
    if (normalizeStatLayerType(layer.type) !== LEAGUE_RENDER_TYPES.playerScore) {
        return null;
    }

    return normalizePlayerRole(layer.role || layer.playerRole || layer.player || layer.playerTarget) || "top";
}

function getLeagueRenderValues(state) {
    const blueTeam = state && state.team && state.team.blue ? state.team.blue : {};
    const redTeam = state && state.team && state.team.red ? state.team.red : {};

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
        playerScores: getPlayerScoreValues(state),
        time: formatGameTime(state && state.game && state.game.time)
    };
}

function getPlayerScoreValues(state) {
    const scores = createEmptyPlayerScoreValues();
    const players = state && Array.isArray(state.player) ? state.player : [];
    const usedRoles = {
        blue: new Set(),
        red: new Set()
    };

    players.forEach((player) => {
        const team = getPlayerTeam(player);
        const role = getPlayerRoleWithFallback(player, usedRoles[team]);

        usedRoles[team].add(role);
        scores[team][role] = formatPlayerScore(player);
    });

    return scores;
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

function formatScore(blueValue, redValue) {
    return `${formatValue(blueValue)} - ${formatValue(redValue)}`;
}

function getErrorMessage(error) {
    return error instanceof Error && error.message
        ? error.message
        : "OBS render failed.";
}
