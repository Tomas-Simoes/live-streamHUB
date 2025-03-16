import { DataProcessorService } from "../services/data-processor.service";
import { eventEmitter } from "../services/event-emitter.service";
import { GameEventsService } from "../services/game-events.service";

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
        console.log(processedData)
    }
}