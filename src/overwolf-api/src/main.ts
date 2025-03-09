import { BrowserWindow } from "electron";
import path from "node:path";

export default class Main {
    static mainWindow: Electron.BrowserWindow;
    static app: Electron.App;
    static BrowserWindow;

    private static onWindowAllClosed() {
        if (process.platform !== 'darwin') {
            Main.app.quit;
        }
    }

    private static onClose() {
    //    Main.mainWindow = null;
    }

    private static onReady() {
        Main.mainWindow = new Main.BrowserWindow({
            width: 800,
            height: 800,
            webPreferences: {
                preload: path.join(__dirname, 'preload.ts')
            }
        
        })

        Main.mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY)
        Main.mainWindow.on('closed', Main.onClose)
    }

    static main(app: Electron.App, browserWindow: typeof Electron.BrowserWindow) {
        Main.BrowserWindow = browserWindow
        Main.app = app;

        Main.app.on('window-all-closed', Main.onWindowAllClosed)
        Main.app.on('ready', Main.onReady)
    }
}