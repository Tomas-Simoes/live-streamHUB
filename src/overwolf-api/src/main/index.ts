import Electron from 'electron'
import { Application } from "./app"

const ElectronApp = Electron.app

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