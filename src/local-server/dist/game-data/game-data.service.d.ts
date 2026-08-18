import { OnModuleDestroy } from '@nestjs/common';
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
export declare class GameDataService implements OnModuleDestroy {
    private readonly updatesSubject;
    readonly updates$: import("rxjs").Observable<NormalizedGameState>;
    private tick;
    private state;
    private readonly mockInterval;
    constructor();
    onModuleDestroy(): void;
    getState(): NormalizedGameState;
    getBindings(): {
        key: string;
        label: string;
        group: string;
        format: string;
    }[];
    ingest(payload: unknown): NormalizedGameState;
    private normalizeIncomingPayload;
    private toRecord;
    private createMockState;
}
export {};
