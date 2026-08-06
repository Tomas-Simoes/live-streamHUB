import { DataProcessorService } from "../services/data-processor.service";
import { eventEmitter } from "../services/event-emitter.service";
import { GameEventsService } from "../services/game-events.service";
import http from "http";
import https from "https";

import LeagueDataMap from "@data-map/LeagueDataMap.json"


export default class GameDataController {
    public readonly dataProcessorService: DataProcessorService;
    public readonly gameEventService: GameEventsService;

    constructor(
    ) {
        this.dataProcessorService = new DataProcessorService()
        this.gameEventService = new GameEventsService()

        eventEmitter.on('dataReceived', (unprocessedData) => {
            this.receivedData(unprocessedData)
        })
    }

    public startGameDataService() {
        let platform = process.platform;

        if (platform == "darwin" || platform == 'win32') {
            eventEmitter.emit('log', `Running application in ${platform}-mode. Using GEP data`)
            this.gameEventService.runOverwolfPackageManager()
        } else {
            eventEmitter.emit('log', `Linux is not supported, using template data for debugging`)
            this.gameEventService.runInTemplateMode()
        }
    }

    private receivedData(unprocessedData) {
        eventEmitter.emit('log', "Data Controller: Received unprocessed data, passing it to DataProcessorService.", unprocessedData)

        let processedData = this.dataProcessorService.processData(unprocessedData, LeagueDataMap)
        console.log(JSON.stringify(processedData, null, 2))

        void this.forwardToBackend(unprocessedData, processedData)
    }

    private async forwardToBackend(rawData, processedData) {
        const backendBaseUrl = (process.env.HUB_BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '')

        try {
            await this.postJson(`${backendBaseUrl}/game-data/ingest`, {
                source: 'overwolf-electron',
                raw: rawData,
                processed: processedData
            })
        } catch (error) {
            eventEmitter.emit('log', 'Data Controller: backend ingest failed.', error)
        }
    }

    private postJson(urlString: string, payload): Promise<void> {
        return new Promise((resolve, reject) => {
            const url = new URL(urlString)
            const body = JSON.stringify(payload)
            const requestModule = url.protocol === 'https:' ? https : http

            const request = requestModule.request({
                method: 'POST',
                hostname: url.hostname,
                port: url.port,
                path: `${url.pathname}${url.search}`,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                }
            }, (response) => {
                response.resume()
                response.on('end', () => resolve())
            })

            request.on('error', reject)
            request.write(body)
            request.end()
        })
    }
}
