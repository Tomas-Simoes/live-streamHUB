import { contextBridge, ipcRenderer } from "electron";
import {platform, cpus, totalmem } from 'os'

ipcRenderer.on('console-message', (event, message, ...args) => { 
    console.log(message, ...args)
})

contextBridge.exposeInMainWorld('versions', {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron
})

