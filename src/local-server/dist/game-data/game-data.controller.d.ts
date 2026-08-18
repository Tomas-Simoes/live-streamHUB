import { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { GameDataService } from './game-data.service';
export declare class GameDataController {
    private readonly gameDataService;
    constructor(gameDataService: GameDataService);
    getState(): import("./game-data.service").NormalizedGameState;
    getBindings(): {
        key: string;
        label: string;
        group: string;
        format: string;
    }[];
    live(): Observable<MessageEvent>;
    ingest(payload: any): import("./game-data.service").NormalizedGameState;
}
