import {
  OWGames,
  OWGameListener,
  OWWindow
} from '@overwolf/overwolf-api-ts';

import { WINDOW_NAMES, GAME_IDS } from "../util";

import RunningGameInfo = overwolf.games.RunningGameInfo;
import AppLaunchTriggeredEvent = overwolf.extensions.AppLaunchTriggeredEvent;

import { OverwolfPlugin } from "../OverwolfPlugin.js";

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
  private _processManagerPlugin: any;

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

  public async run_services() {
    this._processManagerPlugin = new OverwolfPlugin("process-manager-plugin", true);
    var processId = 0;

    const batchFilePath = await this.get_service_path();
    this._processManagerPlugin.initialize(status => {
      if (!status) {
        console.error("Process Manager Plugin couldn't be loaded.");
        return;
      }

      console.log("Process manager plugin loaded.")

      const local_path = "C:\\Users\\tomas\\OneDrive\\Desktop\\Folders\\projects\\League-Live-Desk\\run_services.bat"
      const args = ""
      const environmentVariables = {}
      
      this._processManagerPlugin.get().onDataReceivedEvent.addListener(({ error, data }) => {
        if (error) {
          console.error(error);
        }
        
        if (data) {
          console.log(data);
        }
      });
      
      let _processId = -1;
      this._processManagerPlugin.get().onProcessExited.addListener(({processId, exitCode}) => {
        console.log(`process exit - pid=${processId} exitCode=${exitCode}`);
        if (_processId == processId) {
          processId = -1;
        }
      });
      
      this._processManagerPlugin.get().launchProcess("local_path", 
        args, 
        JSON.stringify(environmentVariables), 
        true, 
        false, // if we close the app, don't close notepad
        ({ error, data }) => {
          if (error) {
            console.error(error);
          }
    
          if (data) {
            _processId = data;
            console.log(`process launched - pid=${_processId}`);
          }
        })
      });
  }

  private async get_service_path() : Promise<String> {
    return new Promise((resolve, reject) => {
      overwolf.extensions.current.getManifest(
        function(app){
          if(app){
            console.log(app)
            const extensionId = app.UID;
            const version = app.meta.version;

            const path = `${overwolf.io.paths.localAppData}\\Overwolf\\Extensions\\${extensionId}\\${version}\\run_services.bat` 
            resolve(path);
          } else {
            reject('Failed to retrieve manifest');
          }
      })
    })
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

  const backgroundController = BackgroundController.instance();
  backgroundController.run();
  backgroundController.run_services();
