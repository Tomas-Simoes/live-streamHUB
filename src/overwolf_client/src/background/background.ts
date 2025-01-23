import {
  OWGames,
  OWGameListener,
  OWWindow
} from '@overwolf/overwolf-api-ts';

import { WINDOW_NAMES, GAME_IDS } from "../util";

import RunningGameInfo = overwolf.games.RunningGameInfo;
import AppLaunchTriggeredEvent = overwolf.extensions.AppLaunchTriggeredEvent;

// The background controller holds all of the app's background logic - hence its name. it has
// many possible use cases, for example sharing data between windows, or, in our case,
// managing which window is currently presented to the user. To that end, it holds a dictionary
// of the windows available in the app.
// Our background controller implements the Singleton design pattern, since only one
// instance of it should exist.
class BackgroundController {
  private static _instance: BackgroundController;
  private _windows: Record<string, OWWindow> = {};
  private _gameListener: OWGameListener;

  private constructor() {
    // Populating the background controller's window dictionary
    this._windows[WINDOW_NAMES.desktop] = new OWWindow(WINDOW_NAMES.desktop);
    this._windows[WINDOW_NAMES.inGame] = new OWWindow(WINDOW_NAMES.inGame);

    // When a a supported game game is started or is ended, toggle the app's windows
    this._gameListener = new OWGameListener({
      onGameStarted: this.toggleWindows.bind(this),
      onGameEnded: this.toggleWindows.bind(this)
    });

    overwolf.extensions.onAppLaunchTriggered.addListener(
      e => this.onAppLaunchTriggered(e)
    );
  };

  public static instance(): BackgroundController {
    if (!BackgroundController._instance) {
      BackgroundController._instance = new BackgroundController();
    }

    return BackgroundController._instance;
  }

 
  public async run() {
    this._gameListener.start();

    const currWindowName = (await this.isSupportedGameRunning())
      ? WINDOW_NAMES.inGame
      : WINDOW_NAMES.desktop;

    this._windows[currWindowName].restore();
  }

  private async onAppLaunchTriggered(e: AppLaunchTriggeredEvent) {
    console.log('onAppLaunchTriggered():', e);

    if (!e || e.origin.includes('gamelaunchevent')) {
      return;
    }

    if (await this.isSupportedGameRunning()) {
      this._windows[WINDOW_NAMES.desktop].close();
      this._windows[WINDOW_NAMES.inGame].restore();
    } else {
      this._windows[WINDOW_NAMES.desktop].restore();
      this._windows[WINDOW_NAMES.inGame].close();
    }
  }

  private toggleWindows(info: RunningGameInfo) {
    if (!info || !this.isSupportedGame(info)) {
      return;
    }

    if (info.isRunning) {
      this._windows[WINDOW_NAMES.desktop].close();
      this._windows[WINDOW_NAMES.inGame].restore();
    } else {
      this._windows[WINDOW_NAMES.desktop].restore();
      this._windows[WINDOW_NAMES.inGame].close();
    }
  }

  private async isSupportedGameRunning(): Promise<boolean> {
    const info = await OWGames.getRunningGameInfo();

    return info && info.isRunning && this.isSupportedGame(info);
  }

  // Identify whether the RunningGameInfo object we have references a supported game
  private isSupportedGame(info: RunningGameInfo) {
    return GAME_IDS.includes(info.classId);
  }
}

BackgroundController.instance().run();
