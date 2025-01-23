export const GAME_FEATURES = new Map<number, string[]>([
  // League of Legends
  [
    5426,
    [
      'live_client_data',
      'matchState',
      'match_info',
      'death',
      'respawn',
      'abilities',
      'kill',
      'assist',
      'gold',
      'minions',
      'summoner_info',
      'gameMode',
      'teams',
      'level',
      'announcer',
      'counters',
      'damage',
      'heal'
    ]
  ],
]);

export const GAME_IDS = Array.from(GAME_FEATURES.keys());

export const WINDOW_NAMES = {
  inGame: 'in_game',
  desktop: 'desktop'
};

export const WSS_URL = "ws://localhost:80/"

