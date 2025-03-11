import { EventEmitter } from "events";
import { overwolf } from "@overwolf/ow-electron";
import { app as ElectronApp } from "electron";

import fs from 'fs' // remove after 
import path from "path";

const app = ElectronApp as overwolf.OverwolfApp;

const GEP_SUPPORTED_GAMES: number[] = [
    5426, // League of Legends
    22730 // Counter-Strike 2
]

const GEP_FEATURES: string[] = [
    'live_client_data',
    'matchState',
    'counters',
    'death',
    'respawn',
    'abilities',
    'kill',
    'assist',
    'gold',
    'minions',
    'gameMode',
    'teams',
    'level',
    'announcer',
    'damage',
]
export class GameEventsService extends EventEmitter {
    private gepAPI !: overwolf.packages.OverwolfGameEventPackage;
    private gepGamesID: number[] = [];
    private activeGame = 0

    constructor() {
        super();

    }
    
    public registerGames(gepGamesId: number[]) {
        this.emit('log', `register game events for ${gepGamesId}`)
        this.gepGamesID = gepGamesId;
    }
    
    public async setRequiredFeaturesForAllSuportedGames() {
        await Promise.all(this.gepGamesID.map(async (gameId) => {
            this.emit('log', `set-required-feature for: ${gameId}`);
            await this.gepAPI.setRequiredFeatures(gameId, GEP_FEATURES); 
        }))
    }
    
    public registerOverwolfPackageManager() {
        let platform = process.platform;

        if (!(platform == "darwin" || platform == 'win32')) {
            this.emit('log', `Running application in ${platform}-mode. Using template data`)
        } else {
            this.emit('log', `Running application in ${platform}-mode. Using GEP data`)
        
            this.registerOverwolfPackageManager();
        }
        
        app.overwolf.packages.on('ready', (e, packageName, version) => {
            if (packageName !== 'gep')
                return;

            this.emit('log', `GEP ${version} package is ready `);
            
            this.onGameEventsPackageReady();
            this.emit('ready');
        })

        app.overwolf.packages.on('failed-to-initialize', (e, packageName) => {
            this.emit('log', `Failed to initialize ${packageName}: `, e)
        })

        app.overwolf.packages.on('crashed', (e, canRecover) => {
            this.emit('log', 'Package Manager crashed: ', e)
        })
    }

    private async onGameEventsPackageReady() {
        this.gepAPI = app.overwolf.packages.gep;
        
        this.gepAPI.removeAllListeners();
        
        this.registerGames(GEP_SUPPORTED_GAMES)
        this.setRequiredFeaturesForAllSuportedGames();

        this.gepAPI.on('game-detected', (e, gameId, name, gameInfo) => {
            if (!this.gepGamesID.includes(gameId)){
                this.emit('log', `GEP: game ${name} is not registered.`)
                return
            }

            this.emit('log', 'GEP: register game-detected ', gameId, name, gameInfo);
            e.enable();
            this.activeGame = gameId
        })

        this.gepAPI.on('new-game-event', (e, gameId, ...args) => {
            this.emit('log', 'GEP: new-event for game ', gameId, ...args)

            this.saveDataOnFile(args[0])
        })
        
        this.gepAPI.on('new-info-update', (e, gameId, ...args) => {
            this.emit('log', 'GEP: info-update for game ', gameId, args[0])

            this.saveDataOnFile(args[0])
        })
        
        this.gepAPI.on('error', (e, gameId, error, ...args) => {
            this.emit('log', 'gep-error', gameId, error, args[0]);
            this.activeGame = 0
        })
    }
    
    private saveDataOnFile(json_data) {
        const dirPath = 'data_templates'; // Define the directory path
        const filePath = path.join(dirPath, `${json_data['category']}-${json_data['key']}.json`); // Ensure it's a file
    
        let data = JSON.stringify(json_data, null, 2);
    
        fs.appendFile(filePath, data + '\n', (err) => {
            if (err) {
                this.emit('log', 'GEP: Error writing to file', err);
            }
        });
    }
}