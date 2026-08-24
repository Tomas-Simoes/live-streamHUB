class GameProcessor {
    createInitialState() {
        return {
            source: "overwolf",
            connected: false,
            game: {
                time: 0,
                mode: "Unknown",
                map: "Unknown",
                phase: "Waiting"
            },
            team: {
                blue: {
                    name: "Blue",
                    gold: 0,
                    kills: 0,
                    minions: 0,
                    objectives: 0
                },
                red: {
                    name: "Red",
                    gold: 0,
                    kills: 0,
                    minions: 0,
                    objectives: 0
                }
            },
            player: [],
            events: {
                latest: "Waiting for game data",
                feed: []
            },
            updatedAt: new Date().toISOString()
        };
    }
    ingestLiveData(currentState, type, payload) {
        if (type === "event") {
            return this.ingestEvent(currentState, payload);
        }
        return this.ingestInfo(currentState, payload);
    }

    ingestInfo() {
        throw new Error("GameProcessor subclasses must implement ingestInfo.");
    }

    ingestEvent(currentState, payload) {
        const events = payload && payload.events;
        const eventNames = Array.isArray(events)
            ? events.map((event) => event.name || event.EventName).filter(isNonEmptyString)
            : [];
        const latest = eventNames[eventNames.length - 1] || currentState.events.latest;
        return {
            ...currentState,
            connected: true,
            events: {
                latest,
                feed: [...currentState.events.feed, ...eventNames].slice(-30)
            }
        };
    }
    deserializeMaybeJson(value) {
        if (typeof value !== "string") {
            return value;
        }
        try {
            return JSON.parse(value);
        }
        catch {
            return value;
        }
    }
}
function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
}
function isPresent(value) {
    return value !== null && value !== undefined && value !== "";
}
