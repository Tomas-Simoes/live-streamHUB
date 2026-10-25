import { HubLayout } from '../../../shared/types/hub.types';
import { LayerType } from '../../../shared/types/layer.types';
import { createCblolBroadcastHubLayout } from '../../../shared/templates/league-broadcast-hub.template';

/** Native functional components with no prepared hub's custom visual identity. */
export function createBroadcastScaffold(): HubLayout {
  const source = createCblolBroadcastHubLayout();
  const layers = source.layers!.filter(layer => [LayerType.LolScorebug, LayerType.LolPlayerRoster].includes(layer.type));
  for (const layer of layers) {
    layer.style = {};
    if (layer.type === LayerType.LolScorebug) {
      layer.id = 'hub-scoreboard'; layer.name = 'Match scoreboard'; layer.width = 1200; layer.height = 100; layer.position = { x: 960, y: 50 }; layer.partStyles = {};
      layer.blueAccent = '#78818b'; layer.redAccent = '#78818b';
    } else if (layer.type === LayerType.LolPlayerRoster) {
      layer.id = `hub-${layer.team}-roster`; layer.name = `${layer.team} player table`; layer.width = 600; layer.height = 280;
      layer.position = { x: layer.team === 'blue' ? 660 : 1260, y: 940 }; layer.partStyles = {};
    }
  }
  return { backgroundId: source.backgroundId, templateId: 'ai-authored', layers };
}
