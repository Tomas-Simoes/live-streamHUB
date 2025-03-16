import LeagueDataMap from "@data-map/LeagueDataMap.json"
import { eventEmitter } from "./event-emitter.service"

export class DataProcessorService {
    private processedData

    constructor () {

    }

    public processData(unprocessedData, dataMap) {
        const { currentDataMap } = dataMap
        let keyFilter;

        Object.keys(currentDataMap).forEach((key, index) => {
            switch (key[0]) {
                case "*":
                    keyFilter = key.slice(1)
                    
                    if (!(unprocessedData[keyFilter] in currentDataMap[keyFilter])) {
                        return
                    }
                    
                    let valueFilter = unprocessedData[keyFilter]
                    let nextDataMap = currentDataMap['*' + keyFilter][valueFilter]

                    this.processedData[keyFilter][valueFilter] = this.processData(unprocessedData, nextDataMap)

                    break;
                case ">":
                    return {
                        keyFilter: this.processData(unprocessedData[keyFilter], currentDataMap[">" + keyFilter])
                    }
                default:
                    return {
                        key: unprocessedData[key]
                    }
            }
        })

        console.log(this.processedData)
    }
}