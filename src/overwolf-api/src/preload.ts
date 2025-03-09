import { contextBridge } from "electron";
import {platform, cpus, totalmem } from 'os'


contextBridge.exposeInMainWorld('versions', {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron
})

