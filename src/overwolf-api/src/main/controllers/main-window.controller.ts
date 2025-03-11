import { overwolf } from "@overwolf/ow-electron";
import {app as ElectronApp, BrowserWindow } from 'electron'
import path from "node:path";
import { GameEventsService } from "../services/game-events.service";

const owElectronApp = ElectronApp as overwolf.OverwolfApp

export default class MainWindowController {
    private mainWindow !: BrowserWindow;
    private gepService: GameEventsService

    constructor (
        gepService: GameEventsService
    ) {
       this.gepService = gepService;
    }   
    
    public createWindow() {
        this.mainWindow = new BrowserWindow({
            width: 800,
            height: 800,
            webPreferences: {
                preload: path.join(__dirname, '../renderer/preload.js')
            }
            
        })
        
        //this.mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY)
        this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html')).then(() => {
            this.printLogMessage("main-window.controller created mainWindow.")
            this.gepService.on('log', this.printLogMessage.bind(this))
            this.gepService.registerOverwolfPackageManager()
        })

    }

    public printLogMessage(message: String, ...args: any[]) {
        if (this.mainWindow.isDestroyed() ?? true) {
            return 
        }

        this.mainWindow.webContents.send('console-message', message, ...args);
    }
}