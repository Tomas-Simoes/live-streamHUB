import { EditorLayer, LayerType } from '../../../shared/types/layer.types';
import type { HubOperation } from './hub-plan';

type Geometry = { position: { x: number; y: number }; width: number; height: number };
export const isBroadcastBranding = (layer: EditorLayer) => /-(left-(info|broadcast-label|round|series|partner)|broadcast-crest)-/.test(layer.id);
export const isPlayerHeader = (layer: EditorLayer) => layer.id.includes('-event-name-');

/** Relationships are inferred from an existing joined pair, not imposed on custom placements. */
export function reflowRosterPair(layers: EditorLayer[], original: Map<string, Geometry>, operations: HubOperation[], touched: Set<string>) {
  const pair = layers.filter(layer => layer.visible && layer.type === LayerType.LolPlayerRoster).sort((a, b) => a.position.x - b.position.x);
  if (pair.length !== 2 || !pair.every(layer => original.has(layer.id))) return;
  for (const layer of pair) {
    if (!touched.has(layer.id)) continue;
    const old = original.get(layer.id)!;
    const movedY = operations.filter(op => op.op === 'move' && (op.target === layer.id || ['players', 'portraits', 'all'].includes(op.target ?? '')))
      .reduce((sum, op) => sum + (op.dy ?? 0), 0);
    layer.position.y = old.position.y + old.height / 2 + movedY - layer.height / 2;
  }
  const [left, right] = pair, oldLeft = original.get(left.id)!, oldRight = original.get(right.id)!;
  const joined = Math.abs(oldLeft.position.x + oldLeft.width / 2 - oldRight.position.x + oldRight.width / 2) <= 3;
  const explicitIndividualMove = operations.some(op => op.op === 'move' && pair.some(layer => op.target === layer.id));
  if (!joined || explicitIndividualMove || !pair.every(layer => touched.has(layer.id))) return;
  const resized = pair.some(layer => layer.width !== original.get(layer.id)!.width);
  if (!resized) return;
  const oldCenter = (oldLeft.position.x - oldLeft.width / 2 + oldRight.position.x + oldRight.width / 2) / 2;
  const dx = ((left.position.x - oldLeft.position.x) + (right.position.x - oldRight.position.x)) / 2;
  const seam = oldCenter + dx + (left.width - right.width) / 2;
  left.position.x = seam - left.width / 2; right.position.x = seam + right.width / 2;
}

export function readablePartSize(part: string, requested: number, scoreboard: boolean) {
  const minimum = scoreboard ? (part === 'clock' ? 18 : part.includes('gold') ? 22 : 24) : part === 'kda' ? 16 : part === 'name' ? 18 : 20;
  return Math.max(minimum, requested);
}
