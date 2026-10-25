import { EditorLayer, LayerType } from '../../../shared/types/layer.types';
import { isBroadcastBranding, isPlayerHeader } from './hub-layout';

const aliases = ['all', 'scoreboards', 'players', 'blue-players', 'red-players', 'portraits', 'texts', 'branding', 'player-header'];

/** One resource inventory for the compiler, model context and decoder. */
export function matchesHubTarget(layer: EditorLayer, target: string): boolean {
  return target === layer.id || target === 'all'
    || target === 'scoreboards' && layer.type === LayerType.LolScorebug
    || target === 'players' && layer.type === LayerType.LolPlayerRoster
    || target === 'blue-players' && layer.type === LayerType.LolPlayerRoster && layer.team === 'blue'
    || target === 'red-players' && layer.type === LayerType.LolPlayerRoster && layer.team === 'red'
    || target === 'portraits' && [LayerType.LolPlayerRoster, LayerType.ChampionPortrait].includes(layer.type)
    || target === 'texts' && layer.type === LayerType.Text
    || target === 'branding' && isBroadcastBranding(layer)
    || target === 'player-header' && isPlayerHeader(layer);
}

export function hubTargetInventory(layers: EditorLayer[]) {
  const availableAliases = Object.fromEntries(aliases.flatMap(target => {
    const count = layers.filter(layer => matchesHubTarget(layer, target)).length;
    return count ? [[target, count]] : [];
  }));
  return { aliases: availableAliases, ids: layers.map(layer => layer.id) };
}
