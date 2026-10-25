import { parse } from 'postcss';
import { createLeagueBroadcastPresetLayout } from '../../../shared/templates/league-broadcast-presets.template';
import { EditorLayer, LayerType } from '../../../shared/types/layer.types';
import { rosterFields } from '../../../shared/helpers/roster-fields';

export type HubReferenceRecord = {
  version: 1; id: string; approved: true; provenance: 'approved-native-design'; description: string;
  structure: { canvas: [number, number]; layers: EditorLayer[] };
  styles: { target: string; css: string }[];
  decisions: { choice: string; effect: string }[];
  preview?: { asset: string; caption?: string };
  edits: { before: { layers: EditorLayer[] }; instruction: string; result: { summary: string; styles: { target: string; mode: 'patch' | 'replace'; css: string }[]; operations: Record<string, unknown>[] }; approved: true }[];
};

/** Existing reviewed designs only. No generated output is approved automatically. */
export function nativeReferenceRecord(id: 'pulse' | 'offset' | 'foundry', decisions: HubReferenceRecord['decisions']): HubReferenceRecord {
  const layout = createLeagueBroadcastPresetLayout(id);
  return { version: 1, id, approved: true, provenance: 'approved-native-design',
    description: ({ pulse: 'Bold sports broadcast with layered blue surfaces and coral signals.', offset: 'Compact charcoal broadcast with acid and orange signals and a shared comparison grid.', foundry: 'Condensed industrial broadcast with steel surfaces and restrained yellow/orange accents.' })[id],
    structure: { canvas: [1920, 1080], layers: structuredClone(layout.layers!) },
    styles: layout.layers!.filter(layer => layer.style?.customCss).map(layer => ({ target: layer.id, css: layer.style!.customCss! })),
    decisions, edits: [],
  };
}

// Geometry has dependencies across selectors. For example Pulse's five tracks
// require the level badge to share the portrait track. Never budget individual
// layout rules independently and accidentally teach an incomplete composition.
const layoutProperty = /^(?:display|position|inset(?:-.+)?|top|right|bottom|left|float|clear|box-sizing|(?:min-|max-)?(?:width|height)|aspect-ratio|grid(?:-.+)?|flex(?:-.+)?|(?:row-|column-)?gap|(?:align|justify|place)-(?:items|content|self)|order|z-index|direction|margin(?:-.+)?|padding(?:-.+)?|overflow(?:-.+)?|transform(?:-.+)?|translate|rotate|scale|contain(?:er-.+)?)$/;

/** Real CSS excerpts; cross-selector geometry is included as an atomic unit. */
export function referenceCssContext(record: HubReferenceRecord, maxCharacters = 1600) {
  const examples: { component: string; css: string; layoutIncluded: boolean; rowFields?: string[] }[] = [];
  const functional = record.structure.layers.filter(layer => [LayerType.LolScorebug, LayerType.LolPlayerRoster].includes(layer.type));
  const share = Math.floor(maxCharacters / Math.max(1, functional.length));
  for (const layer of functional) {
    const css = record.styles.find(style => style.target === layer.id)?.css ?? '';
    const result: string[] = [];
    // Presets contain old baseline rules followed by their real overrides.
    // Select the effective final declarations, not the obsolete baseline skin.
    const effective = new Map<string, Map<string, string>>();
    parse(css).walkRules(rule => {
      if (rule.parent?.type !== 'root') return;
      const declarations = effective.get(rule.selector) ?? new Map<string, string>();
      rule.walkDecls(declaration => { declarations.set(declaration.prop, declaration.value); });
      effective.set(rule.selector, declarations);
    });
    const ordered = [...effective].sort(([a], [b]) => {
      const score = (selector: string) => /roster-name|team-code|team-kills/.test(selector) ? 3 : /roster-row|scorebug-team-(blue|red)/.test(selector) ? 2 : 0;
      return score(b) - score(a);
    });
    const ruleText = (selector: string, declarations: [string, string][]) => declarations.length
      ? `${selector}{${declarations.map(([key, value]) => `${key}:${value}`).join(';')}}` : '';
    const geometry = [...effective].map(([selector, declarations]) => ruleText(selector, [...declarations].filter(([key]) => layoutProperty.test(key)))).join('');
    // Reserve room for actual colour/type evidence. When the dependency group
    // does not fit, omit ALL geometry, including grid placements inside name rules.
    const layoutIncluded = !!geometry && geometry.length <= share * .65;
    if (layoutIncluded) result.push(geometry);
    for (const [selector, declarations] of ordered) {
      const value = ruleText(selector, [...declarations].filter(([key]) => !layoutProperty.test(key)));
      if (result.join('').length + value.length <= share) result.push(value);
    }
    examples.push({ component: layer.type === LayerType.LolScorebug ? 'scoreboards' : layer.type === LayerType.LolPlayerRoster && layer.team === 'blue' ? 'blue-players' : 'red-players',
      css: result.join(''), layoutIncluded, ...(layer.type === LayerType.LolPlayerRoster ? { rowFields: rosterFields(layer) } : {}) });
  }
  return { source: record.id, description: record.description, decisions: record.decisions.slice(0, 1),
    usage: 'Craftsmanship evidence, not a palette to copy. When layoutIncluded=false these are surface/type rules only. Design your layout against the CURRENT rowFields and defaultTracks; do not infer missing geometry from an excerpt.', examples };
}

/** Portable source records, not an implemented training job or a claim of image understanding. */
export function exportReferenceRecords(records: HubReferenceRecord[]): string {
  return records.map(record => JSON.stringify(record)).join('\n');
}

/** Only explicitly approved before/instruction/after examples become SFT messages. */
export function exportApprovedEditExamples(records: HubReferenceRecord[]): string {
  return records.flatMap(record => record.edits.filter(edit => edit.approved).map(edit => JSON.stringify({
    source: record.id, messages: [
      { role: 'user', content: JSON.stringify({ instruction: edit.instruction, current: edit.before }) },
      { role: 'assistant', content: JSON.stringify(edit.result) },
    ],
  }))).join('\n');
}
