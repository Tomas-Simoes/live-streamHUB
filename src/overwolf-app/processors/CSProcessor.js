class CSProcessor extends GameProcessor {
    constructor() {
        super();
        this.supportedGameIds = [22730];
    }
    ingestInfo(currentState) {
        return {
            ...currentState,
            connected: true
        };
    }
}
