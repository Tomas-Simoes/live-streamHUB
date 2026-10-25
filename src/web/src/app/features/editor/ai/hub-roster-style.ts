import type { LolPlayerRosterLayer } from '../../../shared/types/layer.types';
import type { PartStyleRule } from './hub-part-style';

/** Resolve simple icon dimensions together with their native row tracks. Explicit
 * custom grids still use rendered validation; decoration and identity are retained. */
export function fitRosterStyleSizes(layer: LolPlayerRosterLayer, input: PartStyleRule[], existing: PartStyleRule[] = []) {
  const rules = structuredClone(input);
  const notes: string[] = [];
  if ([...existing, ...rules].some(rule => ['row', 'surface'].includes(rule.part)
    && rule.declarations.some(item => /^(grid-template-|grid-column|grid-row|display|flex-direction)/.test(item.property)))) return { rules, notes };
  const pixels = (value: string) => /^\d+(?:\.\d+)?px$/.test(value) ? parseFloat(value) : undefined;
  const itemDimensions: PartStyleRule['declarations'] = [];
  for (const rule of rules) if (rule.part === 'items') {
    const width = rule.declarations.find(item => item.property === 'width');
    // A six-slot strip cannot be one 20–64px icon wide. Treat this common
    // inventory error as individual icon sizing, without dropping its decoration.
    const size = width && pixels(width.value);
    if (size !== undefined && size > 0 && size <= 64) {
      rule.declarations = rule.declarations.filter(item => {
        if (['width', 'height'].includes(item.property) && pixels(item.value) !== undefined) { itemDimensions.push(item); return false; }
        return true;
      });
      notes.push('Item dimensions were applied to each icon, preserving all six slots.');
    }
  }
  if (itemDimensions.length) rules.push({ part: 'item', declarations: itemDimensions });
  const values = (part: string) => rules.filter(rule => rule.part === part).flatMap(rule => rule.declarations)
    .filter(item => ['width', 'height'].includes(item.property)).map(item => pixels(item.value)).filter((value): value is number => value !== undefined);
  const portraitValues = values('portrait'), itemValues = values('item');
  if (!portraitValues.length && !itemValues.length) return { rules: rules.filter(rule => rule.declarations.length), notes };
  const rowLimit = Math.max(36, Math.min(64, Math.floor((layer.height - 24) / 5 - 4)));
  const portraitSize = Math.max(36, Math.min(rowLimit, portraitValues.length ? Math.max(...portraitValues) : rowLimit));
  const otherColumns = (layer.showChampion ? portraitSize : 0) + 112 + (layer.showCs ? 42 : 0)
    + (layer.showGold ? 52 : 0) + (layer.showKda ? 70 : 0) + 20 + 22;
  const itemSize = itemValues.length ? Math.max(24, Math.min(42, rowLimit, Math.floor((layer.width - otherColumns) / 6), Math.max(...itemValues))) : undefined;
  for (const rule of rules) for (const item of rule.declarations) {
    if (['width', 'height'].includes(item.property) && pixels(item.value) !== undefined) {
      const size = rule.part === 'portrait' ? portraitSize : rule.part === 'item' ? itemSize : undefined;
      if (size !== undefined && pixels(item.value) !== size) {
        item.value = `${size}px`;
        if (!notes.includes('Portrait and icon sizes were fitted to the available row space.')) notes.push('Portrait and icon sizes were fitted to the available row space.');
      }
    }
  }
  return { rules: rules.filter(rule => rule.declarations.length), notes, portraitSize, itemSize };
}
