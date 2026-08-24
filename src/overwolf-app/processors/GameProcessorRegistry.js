class GameProcessorRegistry {
    constructor() {
        this.fallbackProcessor = new LeagueProcessor();
        this.processors = [
            this.fallbackProcessor,
            new CSProcessor()
        ];
    }
    getProcessorForGame(gameInfo) {
        const gameId = gameInfo && (gameInfo.id || gameInfo.classId);
        const processor = this.processors.find((candidate) => candidate.supportedGameIds.includes(gameId));
        return processor || this.fallbackProcessor;
    }
}
