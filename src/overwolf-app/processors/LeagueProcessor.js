class LeagueProcessor extends GameProcessor {
    constructor() {
        super();
        this.supportedGameIds = [5426, 10902];
    }
    createInitialState() {
        const initialState = super.createInitialState();

        return {
            ...initialState,
            team: {
                blue: {
                    ...initialState.team.blue,
                    towers: 0,
                    dragons: 0,
                    riftHerald: 0,
                    voidGrubs: 0
                },
                red: {
                    ...initialState.team.red,
                    towers: 0,
                    dragons: 0,
                    riftHerald: 0,
                    voidGrubs: 0
                }
            },
            events: {
                latest: "Waiting for League of Legends",
                feed: []
            }
        };
    }
    
    ingestInfo(currentState, payload) {
        const allPlayers = this.deserializeLiveClientValue(payload, "all_players");
        const gameData = this.deserializeLiveClientValue(payload, "game_data");
        const liveClientEvents = this.deserializeLiveClientValue(payload, "events");
      
        const nextState = {
            ...currentState,
            connected: true
        };
       
        if (gameData && typeof gameData === "object") {
            const time = Number(gameData.gameTime) || nextState.game.time;
      
            nextState.game = {
                ...nextState.game,
                time,
                map: gameData.mapName || nextState.game.map
            };
        }
       
        const playerList = this.getPlayerList(allPlayers);
       
        if (playerList) {
            nextState.player = this.assignFallbackRoles(
                playerList.map((player, index) => this.normalizePlayer(player, index))
            );
            nextState.team = this.summarizeTeams(nextState, nextState.player);
        }

        return this.applyObjectiveCountsFromEvents(nextState, liveClientEvents);
    }

    applyObjectiveCountsFromEvents(currentState, value) {
        const events = value && value.Events;

        if (!Array.isArray(events)) {
            return currentState;
        }

        const objectives = events.reduce((score, event) => {
            const eventName = String(event && event.EventName || "");
            const scoringTeam = this.getTowerScoringTeam(event);

            if (scoringTeam) {
                score.towers[scoringTeam] += 1;
                return score;
            }

            const objectiveTeam = this.getObjectiveScoringTeam(event, currentState.player);

            if (!objectiveTeam) {
                return score;
            }

            if (eventName === "DragonKill" || eventName === "DragonKilled") {
                score.dragons[objectiveTeam] += 1;
            }
            if (eventName === "HeraldKill" || eventName === "RiftHeraldKill") {
                score.riftHerald[objectiveTeam] += 1;
            }
            if (eventName === "HordeKill" || eventName === "VoidGrubKill" || eventName === "VoidGrubsKill") {
                score.voidGrubs[objectiveTeam] += 1;
            }

            return score;
        }, createEmptyObjectiveCounts());

        return {
            ...currentState,
            team: {
                blue: {
                    ...currentState.team.blue,
                    towers: objectives.towers.blue,
                    dragons: objectives.dragons.blue,
                    riftHerald: objectives.riftHerald.blue,
                    voidGrubs: objectives.voidGrubs.blue,
                    objectives: getTotalObjectives(objectives, "blue")
                },
                red: {
                    ...currentState.team.red,
                    towers: objectives.towers.red,
                    dragons: objectives.dragons.red,
                    riftHerald: objectives.riftHerald.red,
                    voidGrubs: objectives.voidGrubs.red,
                    objectives: getTotalObjectives(objectives, "red")
                }
            }
        };
    }

    deserializeLiveClientValue(payload, key) {
        const liveClientData = payload && payload.info && payload.info.live_client_data;
        if (!liveClientData || !(key in liveClientData)) {
            if (payload && payload.feature === "live_client_data" && payload.key === key) {
                return this.deserializeMaybeJson(payload.value);
            }
            return undefined;
        }
        return this.deserializeMaybeJson(liveClientData[key]);
    }

    getTowerScoringTeam(event) {
        if (!event || typeof event !== "object") {
            return null;
        }
        if (event.EventName !== "TurretKilled") {
            return null;
        }

        const destroyedTower = String(event.TurretKilled || "").toLowerCase();
        if (destroyedTower.includes("_torder_") || destroyedTower.includes("_t1_")) {
            return "red";
        }
        if (destroyedTower.includes("_tchaos_") || destroyedTower.includes("_t2_")) {
            return "blue";
        }

        return null;
    }

    getObjectiveScoringTeam(event, players) {
        if (!event || typeof event !== "object") {
            return null;
        }

        const explicitTeam = this.normalizeTeamValue(
            event.KillerTeam || event.KillerTeamID || event.Team || event.TeamID
        );

        if (explicitTeam) {
            return explicitTeam;
        }

        const killerName = event.KillerName || event.killerName;

        if (!killerName || !Array.isArray(players)) {
            return null;
        }

        const killer = players.find((player) =>
            player.aliases && player.aliases.some((alias) => namesMatch(killerName, alias))
        );

        return killer ? killer.team : null;
    }
    
    getPlayerList(value) {
        if (Array.isArray(value)) {
            return value;
        }
        if (value && typeof value === "object" && Array.isArray(value.all_players)) {
            return value.all_players;
        }
        return null;
    }
   

    getTeamSide(player, index) {
        const normalizedTeam = this.normalizeTeamValue(player.team || player.teamSide || player.side);

        if (normalizedTeam) {
            return normalizedTeam;
        }

        const team = String(player.team || player.teamSide || player.side || "").toLowerCase();
        if (team.includes("order") || team.includes("blue") || team === "100") {
            return "blue";
        }
        if (team.includes("chaos") || team.includes("red") || team === "200") {
            return "red";
        }
        return index < 5 ? "blue" : "red";
    }

    normalizeTeamValue(value) {
        const team = String(value || "").toLowerCase();

        if (team.includes("order") || team.includes("blue") || team === "100") {
            return "blue";
        }
        if (team.includes("chaos") || team.includes("red") || team === "200") {
            return "red";
        }

        return null;
    }
   
    getScore(player, key, fallback) {
        if (player.scores && player.scores[key] !== undefined) {
            return Number(player.scores[key]) || fallback;
        }
        return Number(player[key]) || fallback;
    }

    normalizePlayer(player, index) {
        const team = this.getTeamSide(player, index);
        const itemSlots = this.normalizeItems(player.items);
        const trinket = itemSlots.find((item) => isTrinketItem(item.id)) || null;
        const aliases = [
            player.summonerName,
            player.riotId,
            player.playerName,
            player.riotIdGameName,
            player.name
        ].filter(isPresent).map(String);

        if (player.riotIdGameName && player.riotIdTagLine) {
            aliases.push(`${player.riotIdGameName}#${player.riotIdTagLine}`);
        }

        return {
            id: player.summonerName || player.riotId || player.playerName || `player-${index}`,
            name: player.summonerName || player.riotId || player.playerName || `Player ${index + 1}`,
            team,
            role: this.getExplicitPlayerRole(player),
            aliases: Array.from(new Set(aliases)),
            championName: player.championName || player.rawChampionName || "-",
            championId: this.getChampionId(player.championName || player.rawChampionName),
            characterName: player.championName || player.rawChampionName || "-",
            level: this.getScore(player, "level", this.getScore(player, "champLevel", 1)),
            kills: this.getScore(player, "kills", 0),
            deaths: this.getScore(player, "deaths", 0),
            assists: this.getScore(player, "assists", 0),
            gold: this.getScore(player, "gold", 0),
            minions: this.getScore(player, "creepScore", this.getScore(player, "minions", 0)),
            items: itemSlots.map((item) => item.name),
            itemIds: itemSlots.map((item) => item.id).filter(isPresent),
            itemSlots,
            trinket
        };
    }

    normalizeItems(value) {
        if (!Array.isArray(value)) {
            return [];
        }

        return value
            .filter(isPresent)
            .map((item) => ({
                id: Number(item.itemID || item.itemId || item.id) || null,
                name: String(item.displayName || item.rawDisplayName || item.rawName || item.itemID || item.id || "Item")
            }))
            .slice(0, 7);
    }

    getChampionId(value) {
        const compact = String(value || "")
            .replace(/^game_character_displayname_/i, "")
            .replace(/[^a-z0-9]/gi, "");
        const normalized = compact.toLowerCase();

        return CHAMPION_ID_ALIASES[normalized] || compact;
    }

    getExplicitPlayerRole(player) {
        const position = String(
            player.position ||
            player.role ||
            player.lane ||
            player.teamPosition ||
            ""
        ).toLowerCase();

        if (position.includes("top")) {
            return "top";
        }
        if (position.includes("jungle")) {
            return "jungle";
        }
        if (position.includes("middle") || position.includes("mid")) {
            return "mid";
        }
        if (position.includes("bottom") || position.includes("bot") || position.includes("adc")) {
            return "adc";
        }
        if (position.includes("utility") || position.includes("support")) {
            return "support";
        }

        return null;
    }

    assignFallbackRoles(players) {
        const usedRoles = {
            blue: new Set(players.filter((player) => player.team === "blue" && player.role).map((player) => player.role)),
            red: new Set(players.filter((player) => player.team === "red" && player.role).map((player) => player.role))
        };

        return players.map((player) => {
            if (player.role) {
                return player;
            }

            const role = PLAYER_ROLE_ORDER.find((candidate) => !usedRoles[player.team].has(candidate)) ||
                PLAYER_ROLE_ORDER[usedRoles[player.team].size % PLAYER_ROLE_ORDER.length];

            usedRoles[player.team].add(role);

            return {
                ...player,
                role
            };
        });
    }
   
    
    summarizeTeams(currentState, players) {
        return players.reduce((teams, player) => {
            const team = teams[player.team];
            team.gold += player.gold;
            team.kills += player.kills;
            team.minions += player.minions;
            return teams;
        }, {
            blue: { ...currentState.team.blue, gold: 0, kills: 0, minions: 0 },
            red: { ...currentState.team.red, gold: 0, kills: 0, minions: 0 }
        });
    }

}

const PLAYER_ROLE_ORDER = ["top", "jungle", "mid", "adc", "support"];
const CHAMPION_ID_ALIASES = {
    kaisa: "Kaisa",
    ksante: "KSante",
    leesin: "LeeSin",
    masteryi: "MasterYi",
    missfortune: "MissFortune",
    monkeyking: "MonkeyKing",
    twistedfate: "TwistedFate",
    xinzhao: "XinZhao"
};

function isTrinketItem(itemId) {
    const id = Number(itemId) || 0;

    return id >= 3330 && id <= 3370;
}

function createEmptyObjectiveCounts() {
    return {
        towers: { blue: 0, red: 0 },
        dragons: { blue: 0, red: 0 },
        riftHerald: { blue: 0, red: 0 },
        voidGrubs: { blue: 0, red: 0 }
    };
}

function getTotalObjectives(objectives, team) {
    return objectives.towers[team] +
        objectives.dragons[team] +
        objectives.riftHerald[team] +
        objectives.voidGrubs[team];
}

function namesMatch(leftValue, rightValue) {
    const left = normalizePlayerName(leftValue);
    const right = normalizePlayerName(rightValue);

    return left === right || stripRiotTag(left) === stripRiotTag(right);
}

function normalizePlayerName(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function stripRiotTag(value) {
    return value.split("#")[0];
}
