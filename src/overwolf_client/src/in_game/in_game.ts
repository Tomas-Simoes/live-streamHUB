import {
  OWGames,
  OWGamesEvents,
  OWHotkeys
} from "@overwolf/overwolf-api-ts";

import { exec } from 'child_process'
import path from 'path'

import { AppWindow } from "../AppWindow";
import { WINDOW_NAMES, GAME_FEATURES, WSS_URL } from "../util";
import Websocket from "../Websocket"


class InGame extends AppWindow {
  private static _instance: InGame;
  private _gameEventsListener: OWGamesEvents;
  private _eventsLog: HTMLElement;
  private _infoLog: HTMLElement;
  private data_to_send = {
    "match_clock": {},
    "chat": [],
    "all_players": {}
  };

  readonly wss = new Websocket(WSS_URL)

  private constructor() {
    super(WINDOW_NAMES.inGame);

    this._eventsLog = document.getElementById('eventsLog');
    this._infoLog = document.getElementById('infoLog');
  }

  public static instance() {
    if (!this._instance) {
      this._instance = new InGame();
    }

    return this._instance;
  }

  public async run() {
    const gameClassId = await this.getCurrentGameClassId();

    const gameFeatures = GAME_FEATURES.get(gameClassId);

    if (gameFeatures && gameFeatures.length) {
      this._gameEventsListener = new OWGamesEvents(
        {
          onInfoUpdates: this.onInfoUpdates.bind(this),
          onNewEvents: this.onNewEvents.bind(this)
        },
        gameFeatures
      );

      this._gameEventsListener.start();
    }
  }

  private onInfoUpdates(info) {
    const primary_key = Object.keys(info)[0]

    if (primary_key == 'live_client_data') {
      const data = info["live_client_data"]
      const event_type = data ? Object.keys(data)[0] : undefined

      if (event_type == 'all_players') {
        this.data_to_send['all_players'] = data;
      }
    }
  }

  private onNewEvents(e) {
    switch (e.events[0].name) {
      case "match_clock":
        if (Object.keys(this.data_to_send["match_clock"]).length == 0) {
          this.data_to_send["match_clock"] = e
        }

        this.logLine(this._eventsLog, {
          "clock": Object.keys(this.data_to_send["match_clock"]).length,
          "chat": this.data_to_send['chat'].length,
          "all_players": Object.keys(this.data_to_send['all_players']).length
        }, true)

        this.wss.sendMessage(JSON.stringify({ 'target': 'app', 'data': this.data_to_send }))

        this.logLine(this._infoLog, this.data_to_send, true)
        this.data_to_send['all_players'] = {};
        this.data_to_send['match_clock'] = {};
        this.data_to_send['chat'] = [];

        break;
      case "chat":
        this.data_to_send["chat"].push(e)
        break;
    }
  }

  // Appends a new line to the specified log
  private logLine(log: HTMLElement, data, highlight) {
    const line = document.createElement('pre');
    line.textContent = JSON.stringify(data, null, 1);

    if (highlight) {
      line.className = 'highlight';
    }

    // Check if scroll is near bottom
    const shouldAutoScroll =
      log.scrollTop + log.offsetHeight >= log.scrollHeight - 10;

    log.appendChild(line);

    if (shouldAutoScroll) {
      log.scrollTop = log.scrollHeight;
    }
  }

  private async getCurrentGameClassId(): Promise<number | null> {
    const info = await OWGames.getRunningGameInfo();

    return (info && info.isRunning && info.classId) ? info.classId : null;
  }
}

InGame.instance().run();
