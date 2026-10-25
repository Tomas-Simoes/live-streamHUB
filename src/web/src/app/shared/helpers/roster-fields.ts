import type { LolPlayerRosterLayer } from '../types/layer.types';

/** The functional DOM order, shared by rendering and model documentation. */
export function rosterFields(layer: LolPlayerRosterLayer): string[] {
  const enabled: Record<string, boolean> = { items: layer.showItems, portrait: layer.showChampion, level: layer.showLevel,
    name: true, cs: layer.showCs, gold: layer.showGold, kda: layer.showKda };
  const order = layer.orientation === 'right' ? ['kda', 'cs', 'gold', 'name', 'level', 'portrait', 'items'] : ['items', 'portrait', 'level', 'name', 'cs', 'gold', 'kda'];
  return order.filter(key => enabled[key]);
}

export function nativeRosterTracks(layer: LolPlayerRosterLayer): string {
  const tracks: Record<string, string> = { items: 'minmax(0,2.6fr)', portrait: 'minmax(0,.55fr)', level: 'minmax(0,.25fr)',
    name: 'minmax(0,1.2fr)', cs: 'minmax(0,.42fr)', gold: 'minmax(0,.55fr)', kda: 'minmax(0,.62fr)' };
  return rosterFields(layer).map(key => tracks[key]).join(' ');
}
