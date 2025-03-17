import LeagueDataMap from "@data-map/LeagueDataMap.json"
import { eventEmitter } from "./event-emitter.service"

export type DataMap = typeof LeagueDataMap

enum ProcessResults {
    FailedFiltering = "Object didn't pass the filtering",
    SucessFiltering = "Object passed the filtering",
    InvalidKey = "Invalid key for current object"
}

export class DataProcessorService {
    private processedData

    constructor() {

    }

    public processData(unprocessedData, dataMap) {
        return this.processMapKeys(unprocessedData, dataMap)
    }

    public processMapKeys(unprocessedData, dataMap: DataMap) {
        let currentDataMap: DataMap = dataMap
        let dataMapKeys = Object.keys(currentDataMap)

        if (!dataMap || dataMapKeys.length === 0) {
            return {}
        }

        if (!unprocessedData) {
            return ProcessResults.InvalidKey
        }

        console.log('received new key map to process: ', dataMapKeys)

        let nextDataMap = { ...currentDataMap }

        for (let i = 0; i < dataMapKeys.length; i++) {
            let currentKey = dataMapKeys[i]
            let cleanKey = this.getCleanKey(currentKey)

            let processedResult = this.processCurrentKey(unprocessedData, currentDataMap, currentKey)

            delete nextDataMap[currentKey]

            let isNestedFilterKey = currentDataMap[currentKey] instanceof Object && currentKey[0] == '*'


            return {
                [!isNestedFilterKey ? cleanKey : unprocessedData[cleanKey]]: processedResult,
                ...this.processMapKeys(unprocessedData, nextDataMap)
            }
        }
    }

    public newProcessMapKeys(unprocessedData: any, dataMap: DataMap, result: any = {}, processedKeys: Set<string> = new Set()) {
        let currentDataMap: DataMap = dataMap
        let dataMapKeys = Object.keys(currentDataMap)

        if (!dataMap || !unprocessedData) {
            return result
        }

        console.log('received new key map to process: ', dataMapKeys)

        const remainingKeys = Object.keys(dataMap).filter(key => !processedKeys.has(key));

        if (remainingKeys.length === 0) {
            return result
        }

        const currentKey = remainingKeys[0]
        const cleanKey = this.getCleanKey(currentKey)

        const processedResult = this.processCurrentKey(unprocessedData, currentDataMap, currentKey)
        processedKeys.add(currentKey)

        const isNestedFilterKey = currentDataMap[currentKey] instanceof Object && currentKey[0] == '*'
        const keyToUse = !isNestedFilterKey ? cleanKey : unprocessedData[cleanKey]

        if (processedResult === ProcessResults.FailedFiltering) {
            return ProcessResults.FailedFiltering
        }

        if (isNestedFilterKey && typeof processedResult === 'object') {
            Object.assign(result, processedResult)
        } else {
            result[keyToUse] = processedResult
        }

        return this.newProcessMapKeys(unprocessedData, dataMap, result, processedKeys)
    }


    private processCurrentKey(currentUnprocessedData, currentDataMap, currentKey) {
        let keyTag = currentKey[0]

        let cleanKey = this.getCleanKey(currentKey)

        let filterValue = currentDataMap[currentKey]
        let unprocessedValue = currentUnprocessedData[cleanKey]

        if (unprocessedValue == undefined) {
            console.log(`got an invalid key ${cleanKey} for ${JSON.stringify(currentUnprocessedData, null, 2)}`)
            return ProcessResults.InvalidKey
        }

        switch (keyTag) {
            case "*":
                console.log(`got a 'filter' key: ${currentKey}`)

                let isFilterMatch = filterValue == unprocessedValue
                let isNestedFilterMatch = filterValue instanceof Object && unprocessedValue in filterValue

                if (!isFilterMatch && !isNestedFilterMatch) {
                    console.log(`failed filtering for a filterValue of ${filterValue} and unprocessedValue of ${unprocessedValue}`)
                    return ProcessResults.FailedFiltering;
                }

                if (isFilterMatch) {
                    console.log(`success filtering.`)

                    return ProcessResults.SucessFiltering;
                }

                if (isNestedFilterMatch) {
                    console.log(`processing nested filtering`)

                    return this.processMapKeys(currentUnprocessedData, filterValue[unprocessedValue])
                }

                break;
            case ">":
                console.log(`got a 'nested value' key: ${currentKey}`)

                if (currentKey.includes('[')) {
                    console.log(`treating ${cleanKey} as an array`)
                    let unprocessedArray = unprocessedValue

                    let processedArray = [];

                    for (let i = 0; i < unprocessedArray.length; i++) {
                        let currentUnprocessedValue = unprocessedArray[i]
                        let processedValue = this.processMapKeys(currentUnprocessedValue, filterValue)

                        processedArray.push(processedValue)
                    }

                    return processedArray;
                } else {
                    return this.processMapKeys(unprocessedValue, filterValue)
                }

            default:
                console.log(`got a 'value' key: ${cleanKey}`)
                return currentUnprocessedData[cleanKey]
        }
    }

    private getCleanKey(currentKey) {
        let cleanKey;

        if (typeof currentKey !== 'string') {
            return String(currentKey);
        }

        cleanKey = currentKey.replace(/[*>]/g, "")

        if (cleanKey.includes("[")) {
            cleanKey = cleanKey.substring(0, cleanKey.indexOf("["))
        }

        return cleanKey
    }

    /*
    private processCurrentKey2(dataMapKeys, keyIndex, unprocessedData, currentDataMap) {
        let currentKey = dataMapKeys[keyIndex]

        let keyTag = currentKey[0]
        let cleanKey = currentKey.slice(1)

        let valueToFilter = unprocessedData[keyTag == "*" || keyTag == ">" ? cleanKey : currentKey]
        let filterKeys = currentDataMap[currentKey]

        if (valueToFilter == undefined) {
            console.log(`Found invalid key entry ${cleanKey} for ${valueToFilter}`)
            return
        }

        switch (keyTag) {
            case "*":
                let isFilterMatch = filterKeys == valueToFilter
                let isNestedFilterMatch = filterKeys instanceof Object && valueToFilter in filterKeys

                if (isFilterMatch) {
                    delete currentDataMap[currentKey]

                    console.log(`Got filter match ${cleanKey}, ${valueToFilter}`)

                    return {
                        [valueToFilter]: this.processData(unprocessedData, currentDataMap)
                    }

                } else if (isNestedFilterMatch) {
                    console.log(`Got a nested filter ${cleanKey}, ${valueToFilter}`)

                    return {
                        [valueToFilter]: this.processData(unprocessedData, filterKeys[valueToFilter])
                    }
                }

                break;
            case ">":
                let isNestedValue = filterKeys instanceof Object

                if (!isNestedValue) {
                    console.log(`Got a invalid nested value ${cleanKey}, ${filterKeys}. If ${cleanKey} is the final value, don't use flag '>'`)
                    return
                }

                console.log(`Got a nested filter ${cleanKey}, ${valueToFilter}`)

                return {
                    [cleanKey]: this.processData(unprocessedData[cleanKey], currentDataMap[currentKey])
                }

                break;
            default:
                let isLastcleanKey = keyIndex + 1 >= dataMapKeys.length

                console.log(`Got ${isLastcleanKey ? "a last key " : "a key "} value {key:${currentKey},  value: ${valueToFilter}}`)

                if (!isLastcleanKey) {
                    delete currentDataMap[currentKey]

                    return {
                        [currentKey]: valueToFilter,
                        [dataMapKeys[keyIndex + 1]]: this.processData(unprocessedData, currentDataMap)
                    }
                }

                return {
                    [cleanKey]: valueToFilter
                }
        }
    }
        */
}
