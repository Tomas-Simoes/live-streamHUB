import { Injectable } from '@nestjs/common';

type TeamSide = 'blue' | 'red';

export interface NormalizedGameState {
    source: 'backend' | 'mock' | 'overwolf';
    connected: boolean;
    game: {
        time: number;
        mode: string;
        map: string;
        phase: string;
    };
    team: Record<TeamSide, {
        name: string;
        gold: number;
        kills: number;
        minions: number;
        objectives: number;
    }>;
    player: Array<{
        id: string;
        name: string;
        team: TeamSide;
        championName: string;
        characterName: string;
        kills: number;
        deaths: number;
        assists: number;
        gold: number;
        minions: number;
        items: string[];
    }>;
    events: {
        latest: string;
        feed: string[];
    };
    updatedAt: string;
}

const bindings = [
    { key: 'game.time', label: 'Game Time', group: 'Game', format: 'time' },
    { key: 'game.phase', label: 'Game Phase', group: 'Game', format: 'text' },
    { key: 'blueTeam.gold', label: 'Blue Gold', group: 'Blue Team', format: 'gold' },
    { key: 'blueTeam.kills', label: 'Blue Kills', group: 'Blue Team', format: 'number' },
    { key: 'blueTeam.minions', label: 'Blue Minions', group: 'Blue Team', format: 'number' },
    { key: 'redTeam.gold', label: 'Red Gold', group: 'Red Team', format: 'gold' },
    { key: 'redTeam.kills', label: 'Red Kills', group: 'Red Team', format: 'number' },
    { key: 'redTeam.minions', label: 'Red Minions', group: 'Red Team', format: 'number' },
    { key: 'player[0].championName', label: 'Player 1 Champion', group: 'Players', format: 'text' },
    { key: 'player[0].kills', label: 'Player 1 Kills', group: 'Players', format: 'number' },
    { key: 'player[5].championName', label: 'Player 6 Champion', group: 'Players', format: 'text' },
    { key: 'currentEvent', label: 'Current Event', group: 'Events', format: 'text' },
]

@Injectable()
export class GameDataService {
    private tick = 0;
    private state: NormalizedGameState = this.createMockState(0);

    constructor() {
        setInterval(() => {
            if (this.state.source === 'overwolf') return;

            this.tick += 1;
            this.state = this.createMockState(this.tick);
        }, 1000)
    }

    getState(): NormalizedGameState {
        return this.state;
    }

    getBindings() {
        return bindings;
    }

    ingest(payload: any): NormalizedGameState {
        const normalized = this.normalizeIncomingPayload(payload);
        this.state = {
            ...this.state,
            ...normalized,
            source: 'overwolf',
            connected: true,
            updatedAt: new Date().toISOString(),
        }

        return this.state;
    }

    private normalizeIncomingPayload(payload: any): Partial<NormalizedGameState> {
        const processed = payload?.processed ?? payload;
        const raw = payload?.raw ?? payload;

        if (processed?.game && processed?.team) {
            return processed;
        }

        if (raw?.category === 'counters' && raw?.key === 'match_clock') {
            return {
                game: {
                    ...this.state.game,
                    time: Number(raw.value) || this.state.game.time,
                },
            }
        }

        if (raw?.category === 'live_client_data' && raw?.key === 'game_data') {
            try {
                const gameData = JSON.parse(raw.value);
                const time = Number(gameData.gameTime) || this.state.game.time;

                return {
                    game: {
                        ...this.state.game,
                        time,
                        mode: gameData.gameMode || this.state.game.mode,
                        map: gameData.mapName || this.state.game.map,
                        phase: time < 900 ? 'Early Game' : time < 1800 ? 'Mid Game' : 'Late Game',
                    },
                }
            } catch {
                return {};
            }
        }

        return {};
    }

    private createMockState(tick: number): NormalizedGameState {
        const champions = ['Ryze', 'Ahri', 'Garen', 'Jinx', 'Leona', 'Zed', 'Ashe', 'Darius', 'Lux', 'Ekko'];
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
        }
    }
}
