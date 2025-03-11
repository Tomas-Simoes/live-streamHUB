import { app as ElectronApp, BrowserWindow } from 'electron'
import  MainWindowController  from './controllers/main-window.controller'
import { GameEventsService } from './services/game-events.service'

export class Application {
    private readonly gepService: GameEventsService;
    private readonly mainWindowController: MainWindowController;

    constructor (
        gepService: GameEventsService,
        mainWindowController: MainWindowController
    ){
        this.gepService = gepService
        this.mainWindowController = mainWindowController
    }

    public run(){
        this.initialize();
    }

    private initialize() {
        this.mainWindowController.createWindow()
    }
}
