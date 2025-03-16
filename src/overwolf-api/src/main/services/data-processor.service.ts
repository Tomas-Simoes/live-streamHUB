import LeagueDataMap from "@data-map/LeagueDataMap.json"
import { eventEmitter } from "./event-emitter.service"

export type DataMap = typeof LeagueDataMap

export class DataProcessorService {
    private processedData

    constructor() {

    }

    public processData(unprocessedData, dataMap: DataMap) {
        const currentDataMap: DataMap = dataMap

        let dataMapKeys = Object.keys(currentDataMap)

        for (let i = 0; i < dataMapKeys.length; i++) {
            let currentKey = dataMapKeys[i]

            if (!currentKey.includes("[")) {
                return this.processCurrentKey(dataMapKeys, i, unprocessedData, currentDataMap)
            }
        }
    }

    private processCurrentKey(dataMapKeys, keyIndex, unprocessedData, currentDataMap) {
        let currentKey = dataMapKeys[keyIndex]

        let keyTag = currentKey[0]
        let keyFilter = currentKey.slice(1)

        let valueToFilter = unprocessedData[keyTag == "*" || keyTag == ">" ? keyFilter : currentKey]
        let filterKeys = currentDataMap[currentKey]

        if (valueToFilter == undefined) {
            console.log(`Found invalid key entry ${keyFilter} for ${valueToFilter}`)
            return
        }

        switch (keyTag) {
            case "*":
                let isFilterMatch = filterKeys == valueToFilter
                let isNestedFilterMatch = filterKeys instanceof Object && valueToFilter in filterKeys

                if (isFilterMatch) {
                    delete currentDataMap[currentKey]

                    console.log(`Got filter match ${keyFilter}, ${valueToFilter}`)

                    return {
                        [valueToFilter]: this.processData(unprocessedData, currentDataMap)
                    }

                } else if (isNestedFilterMatch) {
                    console.log(`Got a nested filter ${keyFilter}, ${valueToFilter}`)

                    return {
                        [valueToFilter]: this.processData(unprocessedData, filterKeys[valueToFilter])
                    }
                }

                break;
            case ">":
                let isNestedValue = filterKeys instanceof Object

                if (!isNestedValue) {
                    console.log(`Got a invalid nested value ${keyFilter}, ${filterKeys}. If ${keyFilter} is the final value, don't use flag '>'`)
                    return
                }

                console.log(`Got a nested filter ${keyFilter}, ${valueToFilter}`)

                return {
                    [keyFilter]: this.processData(unprocessedData[keyFilter], currentDataMap[currentKey])
                }

                break;
            default:
                let isLastKeyFilter = keyIndex + 1 >= dataMapKeys.length

                console.log(`Got ${isLastKeyFilter ? "a last key " : "a key "} value {key:${currentKey},  value: ${valueToFilter}}`)

                if (!isLastKeyFilter) {
                    delete currentDataMap[currentKey]

                    return {
                        [currentKey]: valueToFilter,
                        [dataMapKeys[keyIndex + 1]]: this.processData(unprocessedData, currentDataMap)
                    }
                }

                return {
                    [keyFilter]: valueToFilter
                }
        }
    }
}
