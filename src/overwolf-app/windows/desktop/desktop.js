const MAX_ROWS = 40;
const obsPasswordStore = new ObsPasswordStore();
let isPreparingRender = false;
const nodes = {
    gameStatus: requireElement("game-status"),
    featureStatus: requireElement("feature-status"),
    dataStatus: requireElement("data-status"),
    obsStatus: requireElement("obs-status"),
    obsScene: requireElement("obs-scene"),
    obsHub: requireElement("obs-hub"),
    obsLayers: requireElement("obs-layers"),
    eventLog: requireElement("event-log", HTMLOListElement),
    infoLog: requireElement("info-log", HTMLOListElement),
    playersBody: requireElement("players-body", HTMLTableSectionElement),
    dragHandle: requireElement("drag-handle"),
    refresh: requireElement("refresh", HTMLButtonElement),
    prepareRender: requireElement("prepare-render", HTMLButtonElement),
    obsPasswordDialog: requireElement("obs-password-dialog"),
    obsDialogClose: requireElement("obs-dialog-close", HTMLButtonElement),
    obsDialogPassword: requireElement("obs-dialog-password", HTMLInputElement),
    obsDialogRemember: requireElement("obs-dialog-remember", HTMLInputElement),
    obsDialogError: requireElement("obs-dialog-error", HTMLParagraphElement),
    obsDialogCancel: requireElement("obs-dialog-cancel", HTMLButtonElement),
    obsDialogSubmit: requireElement("obs-dialog-submit", HTMLButtonElement)
};
function requireElement(id, constructorFn) {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Missing required element: ${id}`);
    }
    if (constructorFn && !(element instanceof constructorFn)) {
        throw new Error(`Element ${id} has the wrong type.`);
    }
    return element;
}
function stringify(value) {
    if (value === undefined) {
        return "";
    }
    if (typeof value === "string") {
        return value;
    }
    try {
        return JSON.stringify(value, null, 2);
    }
    catch {
        return String(value);
    }
}
function addRow(target, title, payload) {
    const row = document.createElement("li");
    row.textContent = `${new Date().toLocaleTimeString()} ${title}${payload ? "\n" + stringify(payload) : ""}`;
    target.prepend(row);
    while (target.children.length > MAX_ROWS) {
        target.removeChild(target.lastElementChild);
    }
}
function setText(node, text) {
    node.textContent = text;
}
function renderPlayers(players) {
    nodes.playersBody.textContent = "";
    if (players.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 6;
        cell.className = "muted";
        cell.textContent = "Waiting for all_players data";
        row.appendChild(cell);
        nodes.playersBody.appendChild(row);
        return;
    }
    players.forEach((player) => {
        const row = document.createElement("tr");
        [
            player.championName,
            player.name,
            `${player.kills}/${player.deaths}/${player.assists}`,
            player.minions,
            player.gold,
            player.items.join(", ") || "-"
        ].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = String(value);
            row.appendChild(cell);
        });
        nodes.playersBody.appendChild(row);
    });
}
function renderLiveState(state) {
    if (!state) {
        return;
    }
    setText(nodes.dataStatus, state.connected ? "Receiving game data" : "Waiting");
    renderPlayers(state.player);
    addRow(nodes.infoLog, "Live state", {
        connected: state.connected,
        updatedAt: state.updatedAt,
        game: state.game,
        players: state.player.length,
        latestEvent: state.events.latest
    });
}
function renderObsStatus(status) {
    if (!status) {
        return;
    }

    setText(nodes.obsStatus, status.message || status.state || "Unknown");
    setText(nodes.obsScene, status.sceneName || "-");
    setText(nodes.obsHub, getObsHubText(status));
    setText(nodes.obsLayers, getObsLayerText(status));
    syncPrepareState(status);
}
function getObsHubText(status) {
    if (status.hubName) {
        return status.hubName;
    }
    return status.hubId || "-";
}
function getObsLayerText(status) {
    const layers = Array.isArray(status.layers) ? status.layers : [];
    const sourceText = status.browserSourceName || "-";
    const layerText = layers.length
        ? layers.map(formatObsLayerLabel).join(", ")
        : "static only";

    if (!status.preview) {
        return sourceText === "-" ? layerText : `${sourceText} | ${layerText}`;
    }

    return `${sourceText} | ${layerText} | ${getObsPreviewText(status.preview)}`;
}
function formatObsLayerLabel(layer) {
    const teamLabel = layer.team ? `${getTeamLabel(layer.team)} ` : "";
    const roleLabel = layer.role ? ` ${getRoleLabel(layer.role)}` : "";

    return `${teamLabel}${layer.type}${roleLabel} ${shortId(layer.layerId)}`;
}
function getObsPreviewText(preview) {
    return [
        `K ${preview.kills}`,
        `T ${preview.towers}`,
        `VG ${preview.voidGrubs}`,
        `RH ${preview.riftHerald}`,
        `D ${preview.dragon}`,
        `G ${preview.gold}`,
        `GD ${preview.goldDiff}`,
        `Time ${preview.time}`
    ].filter((part) => !part.includes("undefined")).join(" ");
}
function shortId(value) {
    const text = String(value || "");
    return text.length > 8 ? text.slice(0, 8) : text;
}
function getTeamLabel(team) {
    return String(team || "").toLowerCase() === "red" ? "Red" : "Blue";
}
function getRoleLabel(role) {
    switch (String(role || "").toLowerCase()) {
        case "top":
            return "Top";
        case "jungle":
            return "Jungle";
        case "mid":
            return "Mid";
        case "adc":
            return "ADC";
        case "support":
            return "Support";
        default:
            return String(role || "");
    }
}
function syncPrepareState(status) {
    const state = String(status.state || "");

    if (state === "connecting" || state === "loading-hub" || state === "creating-overlay") {
        setPrepareBusy(true);
        return;
    }

    setPrepareBusy(false);

    if (state === "ready") {
        closePasswordDialog();
        clearPasswordDialogError();
        return;
    }

    if (state === "error") {
        if (isObsConnectionError(status.message)) {
            obsPasswordStore.clearSession();
            obsPasswordStore.forgetRemembered();
            openPasswordDialog(status.message);
            return;
        }

        closePasswordDialog();
    }
}
function handleBackgroundMessage(message) {
    const payload = "content" in message && message.content ? message.content : message;
    if (!isDesktopMessage(payload)) {
        return;
    }
    if (payload.type === "backlog") {
        payload.messages.forEach((backlogMessage) => {
            if (isDesktopMessage(backlogMessage)) {
                handleBackgroundMessage(backlogMessage);
            }
        });
        return;
    }
    if (payload.type === "live-state") {
        renderLiveState(payload.state);
        return;
    }
    if (payload.type === "render-status") {
        renderObsStatus(payload.status);
        return;
    }
    const text = payload.message || "";
    const data = payload.data;
    if (text.includes("Waiting for League")) {
        setText(nodes.gameStatus, "Waiting for League of Legends");
    }
    if (text.includes("League of Legends")) {
        setText(nodes.gameStatus, "League of Legends detected");
    }
    if (text.includes("Required features registered")) {
        setText(nodes.featureStatus, "live_client_data, counters");
    }
    if (text.includes("Failed to set required features")) {
        setText(nodes.featureStatus, "Registration failed");
    }
    if (text.includes("New game event")) {
        addRow(nodes.eventLog, text, data);
        return;
    }
    addRow(nodes.infoLog, text, data);
}
function refreshLiveState() {
    if (!window.overwolf || !overwolf.windows) {
        setText(nodes.dataStatus, "Overwolf API unavailable");
        return;
    }
    overwolf.windows.sendMessage("background", "league-live-desk", { type: "request-live-state" }, () => { });
}
function prepareObsRender() {
    const savedPassword = obsPasswordStore.getPassword();

    if (!savedPassword) {
        openPasswordDialog();
        return;
    }

    connectAndPrepareRender(savedPassword);
}
function submitObsPassword() {
    const password = nodes.obsDialogPassword.value.trim();

    if (!password || isPreparingRender) {
        return;
    }

    if (nodes.obsDialogRemember.checked) {
        obsPasswordStore.remember(password);
    }
    else {
        obsPasswordStore.saveForSession(password);
    }

    connectAndPrepareRender(password);
}
function connectAndPrepareRender(password) {
    if (!window.overwolf || !overwolf.windows) {
        setText(nodes.obsStatus, "Overwolf API unavailable");
        openPasswordDialog("Overwolf API unavailable.");
        return;
    }

    setPrepareBusy(true);
    clearPasswordDialogError();
    setText(nodes.obsStatus, "Preparing OBS render.");
    overwolf.windows.sendMessage("background", "league-live-desk", {
        type: "prepare-render",
        obsPassword: password
    }, () => { });
}
function openPasswordDialog(errorMessage) {
    nodes.obsPasswordDialog.classList.remove("dialog-hidden");
    setPasswordDialogError(errorMessage || "");
    setTimeout(() => {
        nodes.obsDialogPassword.focus();
        nodes.obsDialogPassword.select();
    }, 0);
}
function closePasswordDialog() {
    if (isPreparingRender) {
        return;
    }

    nodes.obsPasswordDialog.classList.add("dialog-hidden");
    clearPasswordDialogError();
}
function setPasswordDialogError(message) {
    nodes.obsDialogError.textContent = message;
    nodes.obsDialogError.classList.toggle("dialog-hidden", !message);
}
function clearPasswordDialogError() {
    setPasswordDialogError("");
}
function setPrepareBusy(isBusy) {
    isPreparingRender = isBusy;
    nodes.prepareRender.disabled = isBusy;
    nodes.obsDialogClose.disabled = isBusy;
    nodes.obsDialogPassword.disabled = isBusy;
    nodes.obsDialogRemember.disabled = isBusy;
    nodes.obsDialogCancel.disabled = isBusy;
    nodes.obsDialogSubmit.disabled = isBusy;
    nodes.obsDialogSubmit.textContent = isBusy ? "Connecting..." : "Connect";
}
function isObsConnectionError(message) {
    const text = String(message || "").toLowerCase();

    return (
        text.includes("websocket") ||
        text.includes("connect") ||
        text.includes("connection") ||
        text.includes("password") ||
        text.includes("authentication")
    );
}
function isDesktopMessage(value) {
    return Boolean(value && typeof value === "object" && "type" in value);
}
nodes.refresh.addEventListener("click", refreshLiveState);
nodes.prepareRender.addEventListener("click", prepareObsRender);
nodes.obsDialogClose.addEventListener("click", closePasswordDialog);
nodes.obsDialogCancel.addEventListener("click", closePasswordDialog);
nodes.obsDialogSubmit.addEventListener("click", submitObsPassword);
nodes.obsDialogPassword.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        submitObsPassword();
    }
});
nodes.obsPasswordDialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closePasswordDialog();
    }
});
nodes.dragHandle.addEventListener("mousedown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (event.button !== 0 || target?.closest(".no-drag")) {
        return;
    }
    if (!window.overwolf || !overwolf.windows) {
        return;
    }
    overwolf.windows.getCurrentWindow((result) => {
        if (result && result.success && result.window) {
            overwolf.windows.dragMove(result.window.id);
        }
    });
});
if (window.overwolf && overwolf.windows && overwolf.windows.onMessageReceived) {
    overwolf.windows.onMessageReceived.addListener(handleBackgroundMessage);
    overwolf.windows.sendMessage("background", "league-live-desk", { type: "request-backlog" }, () => { });
    overwolf.windows.sendMessage("background", "league-live-desk", { type: "request-render-status" }, () => { });
}
addRow(nodes.eventLog, "Waiting for Overwolf game events");
addRow(nodes.infoLog, "Window ready");
refreshLiveState();
