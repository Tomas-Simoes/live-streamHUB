import type { DataBindingDefinition, NormalizedGameState } from '../types/hub';

export const DATA_BINDINGS: DataBindingDefinition[] = [
  {
    key: 'game.time',
    label: 'Game Time',
    group: 'Game',
    format: 'time',
    defaultSize: { width: 180, height: 72 },
  },
  {
    key: 'game.phase',
    label: 'Game Phase',
    group: 'Game',
    format: 'text',
    defaultSize: { width: 220, height: 64 },
  },
  {
    key: 'blueTeam.gold',
    label: 'Blue Gold',
    group: 'Blue Team',
    format: 'gold',
    defaultSize: { width: 210, height: 72 },
  },
  {
    key: 'blueTeam.kills',
    label: 'Blue Kills',
    group: 'Blue Team',
    format: 'number',
    defaultSize: { width: 150, height: 72 },
  },
  {
    key: 'blueTeam.minions',
    label: 'Blue Minions',
    group: 'Blue Team',
    format: 'number',
    defaultSize: { width: 180, height: 72 },
  },
  {
    key: 'redTeam.gold',
    label: 'Red Gold',
    group: 'Red Team',
    format: 'gold',
    defaultSize: { width: 210, height: 72 },
  },
  {
    key: 'redTeam.kills',
    label: 'Red Kills',
    group: 'Red Team',
    format: 'number',
    defaultSize: { width: 150, height: 72 },
  },
  {
    key: 'redTeam.minions',
    label: 'Red Minions',
    group: 'Red Team',
    format: 'number',
    defaultSize: { width: 180, height: 72 },
  },
  {
    key: 'player[0].championName',
    label: 'Player 1 Champion',
    group: 'Players',
    format: 'text',
    defaultSize: { width: 260, height: 68 },
  },
  {
    key: 'player[0].kills',
    label: 'Player 1 Kills',
    group: 'Players',
    format: 'number',
    defaultSize: { width: 170, height: 64 },
  },
  {
    key: 'player[5].championName',
    label: 'Player 6 Champion',
    group: 'Players',
    format: 'text',
    defaultSize: { width: 260, height: 68 },
  },
  {
    key: 'currentEvent',
    label: 'Current Event',
    group: 'Events',
    format: 'text',
    defaultSize: { width: 520, height: 76 },
  },
];

export function getBindingDefinition(key?: string): DataBindingDefinition | undefined {
  return DATA_BINDINGS.find((binding) => binding.key === key);
}

export function readBindingValue(state: NormalizedGameState, path?: string): unknown {
  if (!path) return undefined;

  const aliasPath = path
    .replace(/^blueTeam\./, 'team.blue.')
    .replace(/^redTeam\./, 'team.red.')
    .replace(/^currentEvent$/, 'events.latest');

  const tokens = aliasPath
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);

  let current: unknown = state;
  for (const token of tokens) {
    if (current === null || current === undefined) return undefined;

    if (Array.isArray(current)) {
      current = current[Number(token)];
      continue;
    }

    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[token];
      continue;
    }

    return undefined;
  }

  return current;
}

export function formatBindingValue(value: unknown, binding?: DataBindingDefinition): string {
  if (value === undefined || value === null) return '-';

  if (binding?.format === 'time' && typeof value === 'number') {
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  if (binding?.format === 'gold' && typeof value === 'number') {
    return `${(value / 1000).toFixed(1)}k`;
  }

  if (binding?.format === 'number' && typeof value === 'number') {
    return Math.round(value).toString();
  }

  return String(value);
}
