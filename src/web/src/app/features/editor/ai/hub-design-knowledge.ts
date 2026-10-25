import { createLeagueBroadcastPresetLayout, getBroadcastPresetTokens } from '../../../shared/templates/league-broadcast-presets.template';
import { LayerType } from '../../../shared/types/layer.types';
import { nativeReferenceRecord } from './hub-reference-records';

export type DesignCase = { source: string; evidence: Record<string, unknown>; example: Record<string, unknown>;
  why: { choice: string; effect: string }[]; techniques: Record<string, unknown>[]; edit: { request: string; change: string; preserve: string[] }; avoid: string[]; tags: string[] };

/** Add approved native hubs here; cases carry real tokens/geometry and causal annotations. */
function sourceCase(id: 'pulse' | 'offset' | 'foundry', why: DesignCase['why'], tags: string[]): DesignCase {
  const p = getBroadcastPresetTokens(id), layout = createLeagueBroadcastPresetLayout(id);
  const score = layout.layers!.find(layer => layer.type === LayerType.LolScorebug)!;
  const rosters = layout.layers!.filter(layer => layer.type === LayerType.LolPlayerRoster);
  return {
    source: ({ pulse: 'Pulse', offset: 'Offset', foundry: 'Foundry' } as const)[id],
    evidence: { canvas: [1920, 1080], score: [score.width, score.height], tables: rosters.map(layer => [layer.width, layer.height]),
      joined: true, mirrored: true, namesFace: 'Impact', itemsPerPlayer: 6 },
    example: {
      colors: { background: p.surfaceDeep, text: p.white, muted: p.muted, line: p.line, teamLeft: p.blue, teamRight: p.red },
      typography: { bodyFont: id === 'foundry' ? 'Arial Narrow' : 'Arial', headingFont: id === 'foundry' ? 'Impact' : 'Arial Black', nameFont: 'Impact', uppercaseNames: true },
      panels: { fill: 'solid', corners: id === 'pulse' ? 'cut' : 'square', borderWidth: id === 'offset' ? 0 : 1,
        accentWidth: id === 'offset' ? 0 : 3, teamSections: false, rows: id === 'pulse' ? 'team-gradient' : 'alternating', headerAccent: id === 'offset' ? 'split' : 'none' },
      layout: { scoreboardWidth: score.width, scoreboardHeight: score.height, rosterWidth: rosters[0].width, rosterHeight: rosters[0].height },
    },
    why, edit: { request: 'Make the tables narrower and more compact',
      change: 'Reduce wasted padding and portrait size; reflow both tables, their common header and backdrop as one joined group.',
      preserve: ['center seam', 'readable names', 'strong score hierarchy', 'team signals'] },
    techniques: [
      { reason: 'An accent marks hierarchy without boxing every number.', target: 'scoreboards', part: 'center', declarations: [{ property: id === 'offset' ? 'border-bottom' : 'border-top', value: '2px solid var(--hub-blue)' }, { property: 'background', value: 'var(--hub-surface-deep)' }] },
      { reason: 'Narrow names and quiet secondary text preserve a dense reading order.', target: 'players', part: 'name', declarations: [{ property: 'font-family', value: 'Impact' }, { property: 'letter-spacing', value: '.3px' }] },
    ],
    avoid: ['Shrinking all text equally', 'Leaving a gap between tables after resizing', 'Adding a large branding card when no branding was requested'], tags,
  };
}

export const APPROVED_HUB_DESIGN_CASES: DesignCase[] = [
  sourceCase('pulse', [
    { choice: 'Heavy display scores, condensed names, quiet body labels', effect: 'Scores are noticed first; ten names fit without becoming tiny.' },
    { choice: 'Team-tinted rows with quieter alternating fills', effect: 'The eye tracks a player across the row without ten strong boxes competing.' },
    { choice: 'Blue/coral used as signals over dark layered surfaces', effect: 'Team distinction survives without filling every panel with bright colour.' },
  ], ['sports', 'bold', 'modern', 'blue', 'broadcast']),
  sourceCase('offset', [
    { choice: 'Borderless charcoal rows, acid/orange signals, narrow split header accents', effect: 'The grid feels precise while gameplay remains visually dominant.' },
    { choice: 'Condensed uppercase names, stronger CS, quieter KDA', effect: 'Data density increases while maintaining a useful reading order.' },
    { choice: 'Joined mirrored tables and shared heading', effect: 'Two teams read as one comparison surface instead of unrelated cards.' },
  ], ['editorial', 'minimal', 'flat', 'sharp', 'clean', 'compact']),
  sourceCase('foundry', [
    { choice: 'Condensed headings and names, muted steel separators', effect: 'The numeric hierarchy is strong with little decorative noise.' },
    { choice: 'Yellow/orange signals, neutral backgrounds', effect: 'Colour identifies the teams without reducing text contrast.' },
  ], ['industrial', 'steel', 'utility', 'dark', 'condensed']),
];

export const APPROVED_HUB_REFERENCE_RECORDS = APPROVED_HUB_DESIGN_CASES.map(example => nativeReferenceRecord(example.source.toLowerCase() as 'pulse' | 'offset' | 'foundry', example.why));

/** Retrieve evidence, not a compulsory whole-hub template or a user-facing picker. */
export function hubDesignKnowledge(instruction = '') {
  const words = instruction.toLowerCase();
  return APPROVED_HUB_DESIGN_CASES.map((example, index) => ({ example, index,
    relevance: example.tags.filter(tag => words.includes(tag)).length }))
    .sort((a, b) => b.relevance - a.relevance || a.index - b.index).slice(0, 2)
    .map(({ example: { tags, ...context } }) => context);
}

export const HUB_DESIGN_PRINCIPLES = `Design relationships, not fixed coordinates: scores/team identity are primary, names/gold next, KDA/objectives secondary. Keep related tables and their heading/backdrop aligned. Compact means reduce wasted space before reducing text. Reserve gameplay and the minimap. Use coherent type roles, quiet dividers, restrained accents and optional branding. Approved cases explain design decisions; combine their component treatments freely, including new light/serif styles. Never require the user to select a reference or imitate a named hub.`;
