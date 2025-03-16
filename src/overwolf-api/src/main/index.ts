import { app as ElectronApp } from 'electron'
import { Application } from "./app"

import MainWindowController from "./controllers/window.controller"
import GameDataController  from './controllers/game-data.controller';

const bootstrap = (): Application => {
    ElectronApp.disableHardwareAcceleration();

    return new Application()
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