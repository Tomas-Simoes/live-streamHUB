import  MainWindowController  from './controllers/window.controller'
import GameDataController  from './controllers/game-data.controller';
import { eventEmitter } from './services/event-emitter.service';
import { startLocalServer } from '@local-server/server';
import type { LocalServerHandle } from '@local-server/server';

export class Application {
    private readonly gameDataController: GameDataController
    private readonly mainWindowController: MainWindowController;
    private localServer?: LocalServerHandle;

    constructor (
    ){
        this.mainWindowController = new MainWindowController()
        this.gameDataController = new GameDataController()
    }

    public run(){
        void this.initialize().catch((error) => {
            eventEmitter.emit('log', 'Application: failed to initialize.', error)
        });
    }

    public async shutdown(): Promise<void> {
        await this.localServer?.close();
    }

    private async initialize(): Promise<void> {
        if (isEnabled(process.env.HUB_LOCAL_SERVER_ONLY)) {
            await this.startLocalBridge();
            eventEmitter.emit('log', 'Application: running in local-server-only mode.')
            return;
        }

        await this.mainWindowController.createWindow();
        await this.startLocalBridge();
        this.gameDataController.startGameDataService()
    
        //eventEmitter.on('log', mainWindowController.printLogMessage.bind(mainWindowController))

    }

    private async startLocalBridge(): Promise<void> {
        this.localServer = await startLocalServer();
        eventEmitter.emit('log', 'Application: local server started on http://127.0.0.1:3001')
    }
}

function isEnabled(value?: string): boolean {
    return ['1', 'true', 'yes', 'on'].includes(value?.toLowerCase() ?? '');
}
