import { app as ElectronApp } from 'electron'
import { Application } from "./app"
import MainWindowController from "./controllers/main-window.controller"
import { GameEventsService } from "./services/game-events.service";

const bootstrap = (): Application => {
    const gepService = new GameEventsService();    
    const mainWindowController = new MainWindowController();

    ElectronApp.disableHardwareAcceleration();

    return new Application(gepService, mainWindowController)
}

const app = bootstrap()

ElectronApp.whenReady().then(() => {
    app.run();
})

ElectronApp.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        ElectronApp.quit();
    }
})