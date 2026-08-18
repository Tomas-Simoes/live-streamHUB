(function () {
  const BACKEND_STATE_URL = "http://localhost:3000/game-data/state";
  const MAX_ROWS = 40;

  const nodes = {
    gameStatus: document.getElementById("game-status"),
    featureStatus: document.getElementById("feature-status"),
    backendStatus: document.getElementById("backend-status"),
    eventLog: document.getElementById("event-log"),
    infoLog: document.getElementById("info-log"),
    playersBody: document.getElementById("players-body"),
    dragHandle: document.getElementById("drag-handle"),
    refresh: document.getElementById("refresh")
  };

  function stringify(value) {
    if (value === undefined) {
      return "";
    }

    if (typeof value === "string") {
      return value;
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
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

  function parseMaybeJson(value) {
    if (typeof value !== "string") {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  function getLiveClientValue(update, key) {
    const liveClientData = update && update.info && update.info.live_client_data;

    if (!liveClientData || !(key in liveClientData)) {
      return undefined;
    }

    return parseMaybeJson(liveClientData[key]);
  }

  function renderPlayers(players) {
    const list = Array.isArray(players)
      ? players
      : players && Array.isArray(players.all_players)
        ? players.all_players
        : [];

    nodes.playersBody.textContent = "";

    if (list.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 6;
      cell.className = "muted";
      cell.textContent = "Received all_players, but it did not contain a players array";
      row.appendChild(cell);
      nodes.playersBody.appendChild(row);
      return;
    }

    list.forEach((player) => {
      const row = document.createElement("tr");
      const items = Array.isArray(player.items)
        ? player.items
            .filter(Boolean)
            .map((item) => item.displayName || item.rawDisplayName || item.itemID || item.rawName)
            .filter(Boolean)
            .join(", ")
        : "";

      [
        player.championName || player.rawChampionName || "-",
        player.summonerName || player.riotId || player.playerName || "-",
        `${player.scores && player.scores.kills !== undefined ? player.scores.kills : player.kills || 0}/${player.scores && player.scores.deaths !== undefined ? player.scores.deaths : player.deaths || 0}/${player.scores && player.scores.assists !== undefined ? player.scores.assists : player.assists || 0}`,
        player.scores && player.scores.creepScore !== undefined ? player.scores.creepScore : player.minions || "-",
        player.scores && player.scores.gold !== undefined ? player.scores.gold : player.gold || "-",
        items || "-"
      ].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = String(value);
        row.appendChild(cell);
      });

      nodes.playersBody.appendChild(row);
    });
  }

  function handleBackgroundMessage(message) {
    const payload = message && message.content ? message.content : message;
    if (!payload) {
      return;
    }

    if (payload.type === "backlog" && Array.isArray(payload.messages)) {
      payload.messages.forEach(handleBackgroundMessage);
      return;
    }

    if (payload.type !== "log") {
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

    if (text.includes("Backend ingest response")) {
      setText(nodes.backendStatus, data && data.ok ? `Connected (${data.status})` : `HTTP ${data && data.status}`);
    }

    if (text.includes("Backend ingest failed")) {
      setText(nodes.backendStatus, "Not running");
    }

    if (text.includes("New game event")) {
      addRow(nodes.eventLog, text, data);
      return;
    }

    if (text.includes("Info update")) {
      const allPlayers = getLiveClientValue(data, "all_players");
      if (allPlayers !== undefined) {
        renderPlayers(allPlayers);
      }

      const gameData = getLiveClientValue(data, "game_data");
      if (gameData !== undefined) {
        addRow(nodes.infoLog, "Game data", gameData);
      }

      addRow(nodes.infoLog, text, data);
      return;
    }

    addRow(nodes.infoLog, text, data);
  }

  async function refreshBackendState() {
    try {
      const response = await fetch(BACKEND_STATE_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const state = await response.json();
      setText(nodes.backendStatus, state.connected ? "Connected to Overwolf data" : "Running with mock data");
      addRow(nodes.infoLog, "Backend state", state);
    } catch (error) {
      setText(nodes.backendStatus, "Not running");
      addRow(nodes.infoLog, "Backend state failed", error && error.message ? error.message : String(error));
    }
  }

  nodes.refresh.addEventListener("click", refreshBackendState);
  nodes.dragHandle.addEventListener("mousedown", (event) => {
    if (event.button !== 0 || event.target.closest(".no-drag")) {
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
    overwolf.windows.sendMessage("background", "league-live-desk", { type: "request-backlog" }, () => {});
  }

  addRow(nodes.eventLog, "Waiting for Overwolf game events");
  addRow(nodes.infoLog, "Window ready");
  refreshBackendState();
})();
