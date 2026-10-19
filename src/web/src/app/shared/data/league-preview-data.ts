import { PlayerScoreRole, StatLayerTeam } from '../types/layer.types';

export type LeaguePreviewItem = {
  id: number | null;
  name: string;
};

export type LeaguePreviewPlayer = {
  role: PlayerScoreRole;
  name: string;
  championName: string;
  championId: string;
  championImageUrl?: string;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  creepScore: number;
  gold: number;
  items: LeaguePreviewItem[];
  trinket: LeaguePreviewItem;
};

export type LeaguePreviewTeam = {
  side: StatLayerTeam;
  code: string;
  name: string;
  seed: string;
  accent: string;
  kills: number;
  towers: number;
  dragons: number;
  voidGrubs: number;
  riftHerald: number;
  gold: number;
  players: Record<PlayerScoreRole, LeaguePreviewPlayer>;
};

export type LeaguePreviewData = {
  gameTime: string;
  patch: string;
  teams: Record<StatLayerTeam, LeaguePreviewTeam>;
};

export const LOL_ROLE_OPTIONS: Array<{ value: PlayerScoreRole; label: string }> = [
  { value: 'top', label: 'Top' },
  { value: 'jungle', label: 'Jungle' },
  { value: 'mid', label: 'Mid' },
  { value: 'adc', label: 'ADC' },
  { value: 'support', label: 'Support' },
];

export const LEAGUE_PREVIEW_DATA: LeaguePreviewData = {
  gameTime: '11:28',
  patch: 'Patch 26.17',
  teams: {
    blue: {
      side: 'blue',
      code: 'KC',
      name: 'Karmine Corp',
      seed: 'Seed #1',
      accent: '#34d5e6',
      kills: 1,
      towers: 3,
      dragons: 0,
      voidGrubs: 0,
      riftHerald: 0,
      gold: 18500,
      players: {
        top: createPlayer('top', 'Canna', 'Renekton', 'Renekton', 9, 0, 0, 0, 93, 773, [1055, 3071, 3047, 1036, 2055, 2003], 3364),
        jungle: createPlayer('jungle', 'Yike', 'Wukong', 'MonkeyKing', 8, 0, 1, 0, 80, 542, [6632, 3047, 3133, 2055, 1036, 2003], 3364),
        mid: createPlayer('mid', 'kyenaoo', 'Azir', 'Azir', 9, 0, 2, 0, 128, 87, [6655, 3020, 1052, 1082, 2055, 2003], 3363),
        adc: createPlayer('adc', 'Caliste', 'KaiSa', 'Kaisa', 8, 1, 1, 0, 106, 126, [6672, 3006, 3133, 1036, 2055, 2003], 3363),
        support: createPlayer('support', 'Busio', 'Rakan', 'Rakan', 7, 0, 1, 1, 7, 192, [3190, 2055, 3869, 1028, 2003, null], 3364),
      },
    },
    red: {
      side: 'red',
      code: 'MKOI',
      name: 'Movistar KOI',
      seed: 'Seed #6',
      accent: '#ef7d24',
      kills: 0,
      towers: 0,
      dragons: 0,
      voidGrubs: 3,
      riftHerald: 0,
      gold: 20400,
      players: {
        top: createPlayer('top', 'Myrwn', 'Gwen', 'Gwen', 10, 0, 0, 0, 126, 0, [3115, 3158, 1052, 1026, 2055, 2003], 3363),
        jungle: createPlayer('jungle', 'Elyoya', 'Lee Sin', 'LeeSin', 8, 1, 0, 0, 89, 0, [6692, 3047, 3133, 1036, 2055, 2003], 3364),
        mid: createPlayer('mid', 'Jojopyun', 'Ahri', 'Ahri', 9, 0, 0, 1, 110, 154, [6655, 3020, 1052, 1082, 2055, 2003], 3363),
        adc: createPlayer('adc', 'Supa', 'Varus', 'Varus', 9, 0, 0, 0, 118, 0, [6672, 3006, 1038, 1036, 2055, 2003], 3363),
        support: createPlayer('support', 'Alvaro', 'Rell', 'Rell', 7, 0, 1, 0, 21, 0, [3190, 2055, 3869, 1028, 2003, null], 3364),
      },
    },
  },
};

export const RIOT_ASSET_VERSION = '14.24.1';
const LOCAL_CHAMPIONS = new Set(['Renekton', 'MonkeyKing', 'Azir', 'Kaisa', 'Rakan', 'Gwen', 'LeeSin', 'Ahri', 'Varus', 'Rell']);
const LOCAL_ITEMS = new Set([1055, 3071, 3047, 1036, 2055, 2003, 6632, 3133, 6655, 3020, 1052, 1082, 6672, 3006, 3190, 3869, 1028, 3115, 3158, 1026, 6692, 1038, 3364, 3363]);

export function getPreviewTeam(team: StatLayerTeam) {
  return LEAGUE_PREVIEW_DATA.teams[team];
}

export function getPreviewPlayer(team: StatLayerTeam, role: PlayerScoreRole) {
  return getPreviewTeam(team).players[role];
}

export function formatKda(player: Pick<LeaguePreviewPlayer, 'kills' | 'deaths' | 'assists'>) {
  return `${player.kills}/${player.deaths}/${player.assists}`;
}

export function formatGold(value: number) {
  return `${(value / 1000).toFixed(1)}K`;
}

export function formatGoldDiff(blueGold: number, redGold: number) {
  const diff = blueGold - redGold;
  const prefix = diff > 0 ? '+' : diff < 0 ? '-' : '';

  return `${prefix}${formatGold(Math.abs(diff))}`;
}

export function getChampionImageUrl(championId: string) {
  if (LOCAL_CHAMPIONS.has(championId)) {
    return `/lol-assets/champion/${championId}.png`;
  }
  return `https://ddragon.leagueoflegends.com/cdn/${RIOT_ASSET_VERSION}/img/champion/${championId}.png`;
}

export function getItemImageUrl(itemId: number) {
  if (LOCAL_ITEMS.has(itemId)) {
    return `/lol-assets/item/${itemId}.png`;
  }
  return `https://ddragon.leagueoflegends.com/cdn/${RIOT_ASSET_VERSION}/img/item/${itemId}.png`;
}

function createPlayer(
  role: PlayerScoreRole,
  name: string,
  championName: string,
  championId: string,
  level: number,
  kills: number,
  deaths: number,
  assists: number,
  creepScore: number,
  gold: number,
  itemIds: Array<number | null>,
  trinketId: number,
): LeaguePreviewPlayer {
  return {
    role,
    name,
    championName,
    championId,
    level,
    kills,
    deaths,
    assists,
    creepScore,
    gold,
    items: itemIds.slice(0, 6).map((itemId) => ({
      id: itemId,
      name: itemId ? `Item ${itemId}` : 'Empty',
    })),
    trinket: {
      id: trinketId,
      name: `Trinket ${trinketId}`,
    },
  };
}
