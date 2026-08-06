import { Body, Controller, Get, MessageEvent, Post, Sse } from '@nestjs/common';
import { interval, map, Observable } from 'rxjs';
import { GameDataService } from './game-data.service';

@Controller('game-data')
export class GameDataController {
    constructor(private readonly gameDataService: GameDataService) { }

    @Get('state')
    getState() {
        return this.gameDataService.getState();
    }

    @Get('bindings')
    getBindings() {
        return this.gameDataService.getBindings();
    }

    @Sse('live')
    live(): Observable<MessageEvent> {
        return interval(1000).pipe(
            map(() => ({
                data: this.gameDataService.getState(),
            })),
        );
    }

    @Post('ingest')
    ingest(@Body() payload: any) {
        return this.gameDataService.ingest(payload);
    }
}
