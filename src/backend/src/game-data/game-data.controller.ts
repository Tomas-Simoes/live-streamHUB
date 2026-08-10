import { Body, Controller, Get, MessageEvent, Post, Sse } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { interval, map, Observable } from 'rxjs';
import { GameDataService } from './game-data.service';

const gameStateExample = {
  source: 'mock',
  connected: false,
  game: {
    time: 615,
    mode: 'CLASSIC',
    map: 'Summoner Rift',
    phase: 'Early Game',
  },
  team: {
    blue: {
      name: 'Blue Comets',
      gold: 24200,
      kills: 8,
      minions: 342,
      objectives: 2,
    },
    red: {
      name: 'Red Titans',
      gold: 23500,
      kills: 7,
      minions: 331,
      objectives: 1,
    },
  },
  player: [
    {
      id: 'player-0',
      name: 'Blue 1',
      team: 'blue',
      championName: 'Ryze',
      characterName: 'Ryze',
      kills: 0,
      deaths: 0,
      assists: 1,
      gold: 4300,
      minions: 52,
      items: ['Starter', 'Boots'],
    },
  ],
  events: {
    latest: 'Blue secured the dragon',
    feed: ['Blue secured the dragon', 'Red started Baron Nashor'],
  },
  updatedAt: '2026-08-10T12:00:00.000Z',
};

const bindingExample = {
  key: 'game.time',
  label: 'Game Time',
  group: 'Game',
  format: 'time',
};

@ApiTags('game-data')
@Controller('game-data')
export class GameDataController {
  constructor(private readonly gameDataService: GameDataService) {}

  @ApiOperation({
    summary: 'Get the latest normalized game state',
    description:
      'Returns the backend copy of the current game state. When no Overwolf data has been ingested, the backend returns mock data that updates once per second.',
  })
  @ApiOkResponse({
    schema: { example: gameStateExample },
  })
  @Get('state')
  getState() {
    return this.gameDataService.getState();
  }

  @ApiOperation({
    summary: 'List available editor bindings',
    description:
      'Returns the game-data keys that the web editor can bind to dynamic hub layers.',
  })
  @ApiOkResponse({
    schema: {
      type: 'array',
      example: [bindingExample],
      items: {
        type: 'object',
        properties: {
          key: { type: 'string', example: 'game.time' },
          label: { type: 'string', example: 'Game Time' },
          group: { type: 'string', example: 'Game' },
          format: { type: 'string', example: 'time' },
        },
      },
    },
  })
  @Get('bindings')
  getBindings() {
    return this.gameDataService.getBindings();
  }

  @ApiOperation({
    summary: 'Stream live game state updates',
    description:
      'Opens a server-sent events stream that emits the latest normalized game state once per second.',
  })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    schema: { example: { data: gameStateExample } },
  })
  @Sse('live')
  live(): Observable<MessageEvent> {
    return interval(1000).pipe(
      map(() => ({
        data: this.gameDataService.getState(),
      })),
    );
  }

  @ApiOperation({
    summary: 'Ingest game data from the Overwolf client',
    description:
      'Accepts raw or already-normalized Overwolf game data, merges recognized fields into the backend state, and marks the source as connected Overwolf data.',
  })
  @ApiBody({
    schema: {
      example: {
        raw: {
          category: 'live_client_data',
          key: 'game_data',
          value:
            '{"gameTime":615,"gameMode":"CLASSIC","mapName":"Summoner Rift"}',
        },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      example: { ...gameStateExample, source: 'overwolf', connected: true },
    },
  })
  @Post('ingest')
  ingest(@Body() payload: any) {
    return this.gameDataService.ingest(payload);
  }
}
