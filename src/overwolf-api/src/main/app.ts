import { app as ElectronApp, BrowserWindow } from 'electron'
import  MainWindowController  from './controllers/window.controller'
import GameDataController  from './controllers/game-data.controller';
import { GameEventsService } from './services/game-events.service'
import { eventEmitter } from './services/event-emitter.service';

export class Application {
    private readonly gameDataController: GameDataController
    private readonly mainWindowController: MainWindowController;

    private readonly platform;

    constructor (
    ){
        this.mainWindowController = new MainWindowController()
        this.gameDataController = new GameDataController()
    }

    public run(){
        this.initialize();
    }

    private async initialize(): Promise<void> {
        const { mainWindowController, platform} = this

        await mainWindowController.createWindow();
        this.gameDataController.startGameDataService()
    
        //eventEmitter.on('log', mainWindowController.printLogMessage.bind(mainWindowController))

    }
}
