(function () {
  const LEAGUE_OF_LEGENDS_IDS = [5426, 10902];
  const REQUIRED_FEATURES = ["live_client_data", "counters"];
  const BACKEND_INGEST_URL = "http://localhost:3000/game-data/ingest";
  const DESKTOP_WINDOW = "desktop";
  const IN_GAME_WINDOW = "in_game";
  const logBacklog = [];
  let featuresRegistered = false;

  function isLeagueGame(gameInfo) {
    return (
      gameInfo &&
      (LEAGUE_OF_LEGENDS_IDS.includes(gameInfo.id) ||
        LEAGUE_OF_LEGENDS_IDS.includes(gameInfo.classId)) &&
      gameInfo.isRunning
    );
  }

  function sendToDesktop(message) {
    overwolf.windows.sendMessage(DESKTOP_WINDOW, "league-live-desk", message, () => {});
    overwolf.windows.sendMessage(IN_GAME_WINDOW, "league-live-desk", message, () => {});
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

  function restoreWindow(windowName) {
    overwolf.windows.obtainDeclaredWindow(windowName, (result) => {
      if (!result || !result.success) {
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
      restoreWindow(isLeagueGame(gameInfo) ? IN_GAME_WINDOW : DESKTOP_WINDOW);
    });
  }

  function postToBackend(type, payload) {
    fetch(BACKEND_INGEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: "overwolf-webapp",
        type,
        raw: payload
      })
    }).then((response) => {
      log("Backend ingest response", {
        type,
        ok: response.ok,
        status: response.status
      });
    }).catch((error) => {
      log("Backend ingest failed", {
        type,
        message: error && error.message ? error.message : String(error)
      });
    });
  }

  function postInfoUpdatesToBackend(infoUpdate) {
    const info = infoUpdate && infoUpdate.info;

    if (!info) {
      postToBackend("info", infoUpdate);
      return;
    }

    Object.keys(info).forEach((category) => {
      const updates = info[category];

      if (!updates || typeof updates !== "object") {
        postToBackend("info", infoUpdate);
        return;
      }

      Object.keys(updates).forEach((key) => {
        postToBackend("info", {
          gameId: infoUpdate.gameId,
          feature: infoUpdate.feature,
          category,
          key,
          value: updates[key]
        });
      });
    });
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
    });
  }

  function checkRunningGame() {
    overwolf.games.getRunningGameInfo((gameInfo) => {
      if (isLeagueGame(gameInfo)) {
        log("League of Legends running", gameInfo);
        setRequiredFeatures();
      } else {
        log("Waiting for League of Legends", gameInfo);
      }
    });
  }

  overwolf.games.onGameInfoUpdated.addListener((event) => {
    const gameInfo = event && event.gameInfo;

    log("Game info updated", event);

    if (isLeagueGame(gameInfo)) {
      log("League of Legends detected", gameInfo);
      setRequiredFeatures();
    }
  });

  overwolf.games.events.onNewEvents.addListener((event) => {
    log("New game event", event);
    postToBackend("event", event);
  });

  overwolf.games.events.onInfoUpdates2.addListener((info) => {
    log("Info update", info);
    postInfoUpdatesToBackend(info);
  });

  overwolf.windows.onMessageReceived.addListener((message) => {
    const content = message && message.content;
    if (content && content.type === "request-backlog") {
      sendBacklog();
      checkRunningGame();
    }
  });

  checkRunningGame();
  setInterval(checkRunningGame, 5000);

  if (overwolf.extensions && overwolf.extensions.onAppLaunchTriggered) {
    overwolf.extensions.onAppLaunchTriggered.addListener(openAppWindow);
  }
})();
