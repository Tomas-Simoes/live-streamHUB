import type { NormalizedGameState } from '../types/hub';

const blueChampions = ['Ryze', 'Ahri', 'Garen', 'Jinx', 'Leona'];
const redChampions = ['Zed', 'Ashe', 'Darius', 'Lux', 'Ekko'];
const events = [
  'Blue secured the dragon',
  'Red mid laner picked up a double kill',
  'Blue bot lane destroyed the outer turret',
  'Red started Baron Nashor',
  'Blue support placed deep vision',
  'Red won the river fight',
];

export function createMockGameState(tick = 0): NormalizedGameState {
  const blueKills = 8 + Math.floor(tick / 5) + (tick % 4 === 0 ? 1 : 0);
  const redKills = 7 + Math.floor(tick / 6) + (tick % 7 === 0 ? 1 : 0);
  const time = 615 + tick;
  const eventIndex = Math.floor(tick / 4) % events.length;

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
        gold: 24200 + tick * 58 + blueKills * 290,
        kills: blueKills,
        minions: 342 + tick * 2,
        objectives: 2 + Math.floor(tick / 18),
      },
      red: {
        name: 'Red Titans',
        gold: 23500 + tick * 61 + redKills * 280,
        kills: redKills,
        minions: 331 + tick * 2,
        objectives: 1 + Math.floor(tick / 22),
      },
    },
    player: [...blueChampions, ...redChampions].map((championName, index) => {
      const isBlue = index < 5;
      const laneOffset = index % 5;

      return {
        id: `player-${index}`,
        name: `${isBlue ? 'Blue' : 'Red'} ${laneOffset + 1}`,
        team: isBlue ? 'blue' : 'red',
        championName,
        characterName: championName,
        kills: Math.max(0, Math.floor((tick + laneOffset * 2) / (isBlue ? 8 : 9))),
        deaths: Math.max(0, Math.floor((tick + laneOffset) / (isBlue ? 13 : 12))),
        assists: Math.max(1, Math.floor((tick + laneOffset * 3) / 5)),
        gold: 4300 + laneOffset * 420 + tick * (isBlue ? 14 : 16),
        minions: 52 + laneOffset * 12 + tick,
        items: ['Starter', 'Boots', tick % 2 === 0 ? 'Power Spike' : 'Component'],
      };
    }),
    events: {
      latest: events[eventIndex],
      feed: events.slice(0, eventIndex + 1).reverse(),
    },
    updatedAt: new Date().toISOString(),
  };
}
