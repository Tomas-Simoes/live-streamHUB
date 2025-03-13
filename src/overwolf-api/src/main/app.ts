import { app as ElectronApp, BrowserWindow } from 'electron'
import  MainWindowController  from './controllers/main-window.controller'
import { GameEventsService } from './services/game-events.service'

export class Application {
    private readonly gepService: GameEventsService;
    private readonly mainWindowController: MainWindowController;
    private readonly platform;

    constructor (
        gepService: GameEventsService,
        mainWindowController: MainWindowController
    ){
        this.gepService = gepService
        this.mainWindowController = mainWindowController
        this.platform = process.platform
    }

    public run(){
        this.initialize();
    }

    private async initialize(): Promise<void> {
        const { gepService, mainWindowController, platform} = this

        await mainWindowController.createWindow();
    
        gepService.on('log', mainWindowController.printLogMessage.bind(mainWindowController))
        
        if (platform == "darwin" || platform == 'win32') {
            gepService.emit('log', `Running application in ${platform}-mode. Using GEP data`)
            gepService.runOverwolfPackageManager()
        } else {
            gepService.emit('log', `Linux is not supported, using template data for debugging`)
            gepService.runInTemplateMode()
        }
    }
}
