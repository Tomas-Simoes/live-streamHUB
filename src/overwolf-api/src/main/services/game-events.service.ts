import { EventEmitter } from "events";
import { overwolf } from "@overwolf/ow-electron";
import { app as ElectronApp } from "electron";

const app = ElectronApp as overwolf.OverwolfApp;

export class GameEventsService extends EventEmitter {
    private gepAPI !: overwolf.packages.OverwolfGameEventPackage;
    private gepGamesID: number[] = [];
    private activeGame = 0

    constructor() {
        super();
        this.registerOverwolfPackageManager();
    }

    public registerGames(gepGamesId: number[]) {
        this.emit('log', `register game events for ${gepGamesId}`)
        this.gepGamesID = gepGamesId;
    }

    public async setRequiredFeaturesForAllSuportedGames() {
        await Promise.all(this.gepGamesID.map(async (gameId) => {
            this.emit('log', `set-required-feature for: ${gameId}`);
            await this.gepAPI.setRequiredFeatures(gameId, undefined); 
        }))
    }

    private registerOverwolfPackageManager() {
        app.overwolf.packages.on('ready', (e, packageName, version) => {
            if (packageName !== 'gep')
                return;

            this.emit('log', `gep ${version} package is ready `);
            
            this.onGameEventsPackageReady();
            this.emit('ready');
        })
    }

    private async onGameEventsPackageReady() {
        this.gepAPI = app.overwolf.packages.gep;
        
        this.gepAPI.removeAllListeners();
        
        this.gepAPI.on('game-detected', (e, gameId, name, gameInfo) => {
            if (!this.gepGamesID.includes(gameId)){
                this.emit('log', `gep: game ${name} is not registered.`)
                return
            }

            this.emit('log', 'gep: register game-detected', gameId, name, gameInfo);
            e.enable();
            this.activeGame = gameId
        })

        this.gepAPI.on('new-game-event', (e, gameId, ...args) => {
            this.emit('log', 'new-event', gameId, ...args)
        })

        this.gepAPI.on('new-info-update', (e, gameId, ...args) => {
            this.emit('log', 'info-update', gameId, ...args)
        })

        this.gepAPI.on('error', (e, gameId, error, ...args) => {
            this.emit('log', 'gep-error', gameId, error, ...args);
            this.activeGame = 0
        })
    }
}