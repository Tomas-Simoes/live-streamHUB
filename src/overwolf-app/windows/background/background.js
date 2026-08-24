const LEAGUE_OF_LEGENDS_IDS = [5426, 10902];
const REQUIRED_FEATURES = ["live_client_data", "counters"];
const DESKTOP_WINDOW = "desktop";
const IN_GAME_WINDOW = "in_game";
const logBacklog = [];
const processorRegistry = new GameProcessorRegistry();
let activeProcessor = new LeagueProcessor();
let featuresRegistered = false;
let liveState = activeProcessor.createInitialState();
const obsClient = new ObsWebSocketClient({ url: LiveStreamHubConfig.obsUrl });
const hubApi = new HubApi({ baseUrl: LiveStreamHubConfig.backendUrl });
const leagueRender = new LeagueRender({
    obsClient,
    hubApi,
    onStatus: publishRenderStatus
});
function isLeagueGame(gameInfo) {
    return Boolean(gameInfo &&
        (LEAGUE_OF_LEGENDS_IDS.includes(gameInfo.id || 0) ||
            LEAGUE_OF_LEGENDS_IDS.includes(gameInfo.classId || 0)) &&
        gameInfo.isRunning);
}
function setActiveProcessor(gameInfo) {
    const nextProcessor = processorRegistry.getProcessorForGame(gameInfo);
    if (nextProcessor.constructor !== activeProcessor.constructor) {
        activeProcessor = nextProcessor;
        liveState = activeProcessor.createInitialState();
    }
}
function sendToDesktop(message) {
    overwolf.windows.sendMessage(DESKTOP_WINDOW, "league-live-desk", message, () => { });
    overwolf.windows.sendMessage(IN_GAME_WINDOW, "league-live-desk", message, () => { });
}
function sendBacklog() {
    sendToDesktop({ type: "backlog", messages: logBacklog });
}
function log(message, data) {
    const entry = { type: "log", message, data, createdAt: new Date().toISOString() };
    logBacklog.push(entry);
    while (logBacklog.length > 80) {
        logBacklog.shift();
    }
    if (data === undefined) {
        console.log("[League Live Desk]", message);
        sendToDesktop(entry);
        return;
    }
    console.log("[League Live Desk]", message, data);
    sendToDesktop(entry);
}
function publishLiveState(reason) {
    liveState = {
        ...liveState,
        connected: liveState.connected || featuresRegistered,
        updatedAt: new Date().toISOString()
    };
    sendToDesktop({
        type: "live-state",
        reason,
        state: liveState
    });
}
function publishRenderStatus(status) {
    sendToDesktop({
        type: "render-status",
        status
    });
}
function restoreWindow(windowName) {
    overwolf.windows.obtainDeclaredWindow(windowName, (result) => {
        if (!result || !result.success || !result.window) {
            log(`Failed to obtain ${windowName} window`, result);
            return;
        }
        overwolf.windows.restore(result.window.id, (restoreResult) => {
            if (!restoreResult || !restoreResult.success) {
                log(`Failed to open ${windowName} window`, restoreResult);
            }
        });
    });
}
function openAppWindow() {
    overwolf.games.getRunningGameInfo((gameInfo) => {
        setActiveProcessor(gameInfo);
        restoreWindow(isLeagueGame(gameInfo) ? IN_GAME_WINDOW : DESKTOP_WINDOW);
    });
}
function ingestLiveData(type, payload) {
    liveState = activeProcessor.ingestLiveData(liveState, type, payload);
    publishLiveState(type);
    leagueRender.queueRender(liveState);
}
async function prepareLeagueRender(options) {
    try {
        const status = await leagueRender.prepare({
            obsPassword: options && options.obsPassword,
            initialState: liveState
        });
        log("OBS render prepared", {
            sceneName: status.sceneName,
            hubId: status.hubId,
            browserSourceName: status.browserSourceName,
            overlayFilePath: status.overlayFilePath,
            layers: status.layers
        });
        leagueRender.queueRender(liveState);
    }
    catch (error) {
        log("OBS render preparation failed", serializeError(error));
    }
}
function serializeError(error) {
    if (error instanceof Error) {
        return {
            message: error.message,
            stack: error.stack
        };
    }
    return error;
}
function setRequiredFeatures() {
    if (featuresRegistered) {
        return;
    }
    overwolf.games.events.setRequiredFeatures(REQUIRED_FEATURES, (result) => {
        if (!result || !result.success) {
            log("Failed to set required features", result);
            return;
        }
        featuresRegistered = true;
        log("Required features registered", REQUIRED_FEATURES);
        publishLiveState("features");
    });
}
function checkRunningGame() {
    overwolf.games.getRunningGameInfo((gameInfo) => {
        setActiveProcessor(gameInfo);
        if (isLeagueGame(gameInfo)) {
            log("League of Legends running", gameInfo);
            setRequiredFeatures();
        }
        else {
            log("Waiting for League of Legends", gameInfo);
        }
    });
}
overwolf.games.onGameInfoUpdated.addListener((event) => {
    const gameInfo = event && event.gameInfo;
    log("Game info updated", event);
    setActiveProcessor(gameInfo);
    if (isLeagueGame(gameInfo)) {
        log("League of Legends detected", gameInfo);
        setRequiredFeatures();
    }
});
overwolf.games.events.onNewEvents.addListener((event) => {
    log("New game event", event);
    ingestLiveData("event", event);
});
overwolf.games.events.onInfoUpdates2.addListener((info) => {
    log("Info update", info);
    ingestLiveData("info", info);
});
overwolf.windows.onMessageReceived.addListener((message) => {
    const content = message && message.content;
    if (content && content.type === "request-backlog") {
        sendBacklog();
        checkRunningGame();
        publishLiveState("request-backlog");
    }
    if (content && content.type === "request-live-state") {
        publishLiveState("request");
    }
    if (content && content.type === "request-render-status") {
        publishRenderStatus(leagueRender.getStatus());
    }
    if (content && content.type === "prepare-render") {
        void prepareLeagueRender(content);
    }
});
checkRunningGame();
setInterval(checkRunningGame, 5000);
if (overwolf.extensions && overwolf.extensions.onAppLaunchTriggered) {
    overwolf.extensions.onAppLaunchTriggered.addListener(openAppWindow);
}
