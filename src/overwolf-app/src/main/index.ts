import Electron from 'electron'
import { Application } from "./app"
import { configDotenv } from 'dotenv';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
configDotenv({
    path: `.env.${process.env.NODE_ENV}`
})

console.log(`Running in ${process.env} mode.`)

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