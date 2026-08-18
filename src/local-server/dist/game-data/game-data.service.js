"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameDataService = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const bindings = [
    { key: 'game.time', label: 'Game Time', group: 'Game', format: 'time' },
    { key: 'game.phase', label: 'Game Phase', group: 'Game', format: 'text' },
    {
        key: 'blueTeam.gold',
        label: 'Blue Gold',
        group: 'Blue Team',
        format: 'gold',
    },
    {
        key: 'blueTeam.kills',
        label: 'Blue Kills',
        group: 'Blue Team',
        format: 'number',
    },
    {
        key: 'blueTeam.minions',
        label: 'Blue Minions',
        group: 'Blue Team',
        format: 'number',
    },
    { key: 'redTeam.gold', label: 'Red Gold', group: 'Red Team', format: 'gold' },
    {
        key: 'redTeam.kills',
        label: 'Red Kills',
        group: 'Red Team',
        format: 'number',
    },
    {
        key: 'redTeam.minions',
        label: 'Red Minions',
        group: 'Red Team',
        format: 'number',
    },
    {
        key: 'player[0].championName',
        label: 'Player 1 Champion',
        group: 'Players',
        format: 'text',
    },
    {
        key: 'player[0].kills',
        label: 'Player 1 Kills',
        group: 'Players',
        format: 'number',
    },
    {
        key: 'player[5].championName',
        label: 'Player 6 Champion',
        group: 'Players',
        format: 'text',
    },
    {
        key: 'currentEvent',
        label: 'Current Event',
        group: 'Events',
        format: 'text',
    },
];
let GameDataService = class GameDataService {
    updatesSubject = new rxjs_1.ReplaySubject(1);
    updates$ = this.updatesSubject.asObservable();
    tick = 0;
    state = this.createMockState(0);
    mockInterval;
    constructor() {
        this.updatesSubject.next(this.state);
        this.mockInterval = setInterval(() => {
            if (this.state.source === 'overwolf')
                return;
            this.tick += 1;
            this.state = this.createMockState(this.tick);
            this.updatesSubject.next(this.state);
        }, 1000);
    }
    onModuleDestroy() {
        clearInterval(this.mockInterval);
    }
    getState() {
        return this.state;
    }
    getBindings() {
        return bindings;
    }
    ingest(payload) {
        const normalized = this.normalizeIncomingPayload(payload);
        this.state = {
            ...this.state,
            ...normalized,
            source: 'overwolf',
            connected: true,
            updatedAt: new Date().toISOString(),
        };
        this.updatesSubject.next(this.state);
        return this.state;
    }
    normalizeIncomingPayload(payload) {
        const payloadRecord = this.toRecord(payload);
        const processed = payloadRecord?.processed ?? payload;
        const raw = payloadRecord?.raw ?? payload;
        const processedRecord = this.toRecord(processed);
        const rawRecord = this.toRecord(raw);
        if (processedRecord?.game && processedRecord.team) {
            return processed;
        }
        if (rawRecord?.category === 'counters' && rawRecord.key === 'match_clock') {
            return {
                game: {
                    ...this.state.game,
                    time: Number(rawRecord.value) || this.state.game.time,
                },
            };
        }
        if (rawRecord?.category === 'live_client_data' &&
            rawRecord.key === 'game_data' &&
            typeof rawRecord.value === 'string') {
            try {
                const gameData = JSON.parse(rawRecord.value);
                const time = Number(gameData.gameTime) || this.state.game.time;
                return {
                    game: {
                        ...this.state.game,
                        time,
                        mode: gameData.gameMode || this.state.game.mode,
                        map: gameData.mapName || this.state.game.map,
                        phase: time < 900
                            ? 'Early Game'
                            : time < 1800
                                ? 'Mid Game'
                                : 'Late Game',
                    },
                };
            }
            catch {
                return {};
            }
        }
        return {};
    }
    toRecord(value) {
        return value && typeof value === 'object'
            ? value
            : undefined;
    }
    createMockState(tick) {
        const champions = [
            'Ryze',
            'Ahri',
            'Garen',
            'Jinx',
            'Leona',
            'Zed',
            'Ashe',
            'Darius',
            'Lux',
            'Ekko',
        ];
        const events = [
            'Blue secured the dragon',
            'Red mid laner picked up a double kill',
            'Blue bot lane destroyed the outer turret',
            'Red started Baron Nashor',
        ];
        const time = 615 + tick;
        return {
            source: 'mock',
            connected: false,
            game: {
                time,
                mode: 'CLASSIC',
                map: 'Summoner Rift',
                phase: time < 900 ? 'Early Game' : time < 1800 ? 'Mid Game' : 'Late Game',
            },
            team: {
                blue: {
                    name: 'Blue Comets',
                    gold: 24200 + tick * 58,
                    kills: 8 + Math.floor(tick / 5),
                    minions: 342 + tick * 2,
                    objectives: 2,
                },
                red: {
                    name: 'Red Titans',
                    gold: 23500 + tick * 61,
                    kills: 7 + Math.floor(tick / 6),
                    minions: 331 + tick * 2,
                    objectives: 1,
                },
            },
            player: champions.map((championName, index) => ({
                id: `player-${index}`,
                name: `${index < 5 ? 'Blue' : 'Red'} ${(index % 5) + 1}`,
                team: index < 5 ? 'blue' : 'red',
                championName,
                characterName: championName,
                kills: Math.max(0, Math.floor((tick + index) / 9)),
                deaths: Math.max(0, Math.floor((tick + index) / 13)),
                assists: Math.max(1, Math.floor((tick + index) / 6)),
                gold: 4300 + (index % 5) * 420 + tick * 15,
                minions: 52 + (index % 5) * 12 + tick,
                items: ['Starter', 'Boots'],
            })),
            events: {
                latest: events[Math.floor(tick / 4) % events.length],
                feed: events,
            },
            updatedAt: new Date().toISOString(),
        };
    }
};
exports.GameDataService = GameDataService;
exports.GameDataService = GameDataService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], GameDataService);
//# sourceMappingURL=game-data.service.js.map