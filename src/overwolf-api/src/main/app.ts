import { app as ElectronApp, BrowserWindow } from 'electron'
import  MainWindowController  from './controllers/main-window.controller'
import { GameEventsService } from './services/game-events.service'

export class Application {
    constructor (
        private readonly gepService: GameEventsService,
        private readonly mainWindowController: MainWindowController
    ){
        gepService = new GameEventsService();
    }

    public run(){
        this.initialize();
    }

    private initialize() {
        this.mainWindowController.createWindow()
    }
}
