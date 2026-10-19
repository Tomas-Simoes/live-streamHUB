import { HubLayout } from '../types/hub.types';
import { EditorLayer, ImageLayer, LayerType, LolPlayerRosterLayer, LolScorebugLayer, ShapeLayer, TextLayer } from '../types/layer.types';
import { createCblolBroadcastHubLayout } from './league-broadcast-hub.template';
import { broadcastRowSurface } from './broadcast-design.styles';

type PresetStyle = 'atelier' | 'voltage' | 'pulse' | 'crown' | 'offset' | 'foundry';

type Preset = {
  id: PresetStyle;
  event: string;
  round: string;
  series: string;
  footer: string;
  crest: string;
  ink: string;
  surface: string;
  surfaceDeep: string;
  blue: string;
  red: string;
  line: string;
  white: string;
  muted: string;
  font: string;
  display: string;
};

const PRESETS: Record<PresetStyle, Preset> = {
  atelier: {
    id: 'atelier', event: 'ATELIER  /  SUMMER FINALS', round: 'SUMMER FINALS', series: 'GAME 01 / BO5', footer: 'ATELIER  26', crest: 'A',
    ink: '#091317', surface: '#14242a', surfaceDeep: '#071216', blue: '#97c7c4', red: '#d3a4a4', line: '#b6ccc8', white: '#f4f5ef', muted: '#b7c9c6',
    font: 'Segoe UI, Arial, sans-serif', display: 'Segoe UI, Arial, sans-serif',
  },
  voltage: {
    id: 'voltage', event: 'VOLTAGE  /  CIRCUIT 04', round: 'CIRCUIT 04', series: 'MATCH 01 / 05', footer: 'VOLTAGE // 26', crest: 'V',
    ink: '#060d18', surface: '#0a1928', surfaceDeep: '#050d17', blue: '#29e6d2', red: '#ff4fb0', line: '#57f4e2', white: '#f0fff9', muted: '#a6c9d0',
    font: 'Arial, sans-serif', display: 'Impact, Arial Narrow, sans-serif',
  },
  pulse: {
    id: 'pulse', event: 'PULSE  /  PRO SERIES', round: 'PRO SERIES', series: 'MAP 01 / BO5', footer: 'PULSE  2026', crest: 'P',
    ink: '#081b38', surface: '#12386b', surfaceDeep: '#071a35', blue: '#45b9ff', red: '#ff755b', line: '#a9d8ef', white: '#ffffff', muted: '#b8d9ee',
    font: 'Arial, sans-serif', display: 'Arial Black, Arial, sans-serif',
  },
  crown: {
    id: 'crown', event: 'CROWN  /  WORLD FINAL', round: 'WORLD FINAL', series: 'GAME I / V', footer: 'CROWN  MMXXVI', crest: 'C',
    ink: '#12101e', surface: '#242039', surfaceDeep: '#100d1c', blue: '#e8c882', red: '#c9a8dc', line: '#c8aa70', white: '#fff4dc', muted: '#cfbfab',
    font: 'Georgia, serif', display: 'Georgia, serif',
  },
  offset: {
    id: 'offset', event: 'OFFSET  /  SPLIT FINALS', round: 'SPLIT FINALS', series: 'GAME 01  //  05', footer: 'OFF/SET 26', crest: 'O',
    ink: '#141518', surface: '#272a30', surfaceDeep: '#111317', blue: '#d8f14c', red: '#ff775d', line: '#82917c', white: '#fcfff1', muted: '#c9d0b5',
    font: 'Arial, sans-serif', display: 'Arial Black, Arial, sans-serif',
  },
  foundry: {
    id: 'foundry', event: 'FOUNDRY  /  GRAND FINAL', round: 'GRAND FINAL', series: 'ROUND 01 / 05', footer: 'FOUNDRY 26', crest: 'F',
    ink: '#11181b', surface: '#202a2f', surfaceDeep: '#131c20', blue: '#edc24b', red: '#d98259', line: '#6f8082', white: '#f3f2e9', muted: '#aebcba',
    font: 'Arial Narrow, Arial, sans-serif', display: 'Impact, Arial Narrow, sans-serif',
  },
};

export function getBroadcastPresetTokens(id: PresetStyle) { return { ...PRESETS[id] }; }

export function createLeagueBroadcastPresetLayout(id: PresetStyle): HubLayout {
  const preset = PRESETS[id];
  const layout = createCblolBroadcastHubLayout();
  layout.id = `${id}-broadcast-hub`;
  layout.templateId = `${id}-broadcast`;

  for (const layer of layout.layers ?? []) {
    restyleLayer(layer, preset);
    layer.id = layer.id.replace(/^cblol-/, `${id}-`);
  }
  return layout;
}

function restyleLayer(layer: EditorLayer, preset: Preset) {
  const key = layer.id;

  if (layer.type === LayerType.LolScorebug) {
    styleScorebug(layer, preset);
  } else if (layer.type === LayerType.LolPlayerRoster) {
    styleRoster(layer, preset);
  } else if (layer.type === LayerType.Text) {
    styleText(layer, preset, key);
  } else if (layer.type === LayerType.Shape) {
    styleShape(layer, preset, key);
  } else if (layer.type === LayerType.Image) {
    styleImage(layer, preset, key);
  }
}

function styleScorebug(layer: LolScorebugLayer, p: Preset) {
  layer.name = `${p.footer} team scoreboard`;
  layer.blueAccent = p.blue;
  layer.redAccent = p.red;
  layer.style = {
    color: p.white, borderColor: p.line, borderWidth: p.id === 'offset' ? 0 : 1,
    boxShadow: '0 11px 28px rgb(0 0 0 / 58%)',
    customCss: `
& { overflow: hidden; ${scorebugFrame(p)} }
& .scorebug { background: ${p.surfaceDeep}; font-family: ${p.font}; }
& .scorebug-team { gap: 2%; padding: 0 2.5%; background: transparent; }
& .scorebug-team-blue { background: ${teamField(p, 'blue')}; border-left: ${edgeWidth(p)} solid ${p.blue}; }
& .scorebug-team-red { background: ${teamField(p, 'red')}; border-right: ${edgeWidth(p)} solid ${p.red}; }
& .team-logo { visibility: hidden; flex-basis: 13%; width: 13%; }
& .team-lockup { flex: 1 1 19%; min-width: 0; }
& .team-code { color: ${p.white}; font-family: ${p.display}; font-size: clamp(12px, 3.25cqw, 29px); ${p.id === 'crown' ? 'font-weight: 800;' : ''} }
& .team-seed { color: ${p.muted}; font-size: clamp(6px, 1.1cqw, 10px); }
& .team-gold { color: ${p.white}; font-family: ${p.display}; font-size: clamp(10px, 2.65cqw, 25px); }
& .team-objective { color: ${p.blue}; font-size: clamp(7px, 1.8cqw, 17px); }
& .scorebug-team-red .team-objective { color: ${p.red}; }
& .scorebug-center { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: minmax(0, 1fr) 29%; gap: 0; padding: 0; place-items: center; background: ${centerField(p)}; box-shadow: 1px 0 0 ${p.line} inset, -1px 0 0 ${p.line} inset; }
& .team-kills { min-width: 0; color: ${p.white}; font-family: ${p.display}; font-size: clamp(23px, 4.4cqw, 48px); line-height: 1; transform: translateY(3px); }
& .scorebug-center .team-kills:first-child { grid-column: 1; grid-row: 1; }
& .scorebug-center .team-kills:nth-child(3) { grid-column: 2; grid-row: 1; }
& .score-divider { display: none; }
& .game-clock { position: static; grid-column: 1 / -1; grid-row: 2; width: 100%; height: 100%; min-width: 0; display: grid; place-items: center; padding: 0; transform: none; border: 0; background: transparent; color: ${p.white}; font-family: ${p.display}; font-size: clamp(12px, 2.3cqw, 22px); line-height: 1; }
& .objective-row { gap: 6%; padding: 0 5%; background: ${p.surfaceDeep}; color: ${p.muted}; font-size: clamp(7px, 1.3cqw, 12px); opacity: 1; border-top: 1px solid ${p.line}; }
${scorebugDetails(p)}
`,
  };
}

function scorebugFrame(p: Preset) {
  switch (p.id) {
    case 'voltage': return 'clip-path: polygon(1.5% 0, 98.5% 0, 100% 32%, 100% 100%, 0 100%, 0 32%);';
    case 'pulse': return 'clip-path: polygon(1% 0, 99% 0, 100% 100%, 0 100%);';
    case 'offset': return 'clip-path: none;';
    case 'foundry': return 'clip-path: none;';
    default: return 'clip-path: none;';
  }
}

function edgeWidth(p: Preset) {
  if (p.id === 'offset') return '0';
  if (p.id === 'atelier' || p.id === 'foundry') return '2px';
  return '3px';
}

function teamField(p: Preset, side: 'blue' | 'red') {
  const accent = side === 'blue' ? p.blue : p.red;
  const direction = side === 'blue' ? '90deg' : '270deg';
  if (p.id === 'atelier') return `linear-gradient(${direction}, #21383b, ${p.surfaceDeep} 70%)`;
  if (p.id === 'crown') return `linear-gradient(${direction}, #3c3150, ${p.surfaceDeep} 78%)`;
  if (p.id === 'offset') return `linear-gradient(${direction}, #272a2b, #17191b 78%)`;
  if (p.id === 'foundry') return p.surface;
  return `linear-gradient(${direction}, color-mix(in srgb, ${accent} 32%, ${p.surfaceDeep}), ${p.surfaceDeep} 76%)`;
}

function centerField(p: Preset) {
  if (p.id === 'offset') return 'linear-gradient(180deg, #25282a 0 70%, #17191b 70%)';
  if (p.id === 'crown') return `linear-gradient(180deg, #31283c 0 70%, #191522 70%)`;
  if (p.id === 'voltage') return `linear-gradient(135deg, #0d3a43, #06101d 50%, #3e1537)`;
  return `linear-gradient(180deg, ${p.surface} 0 70%, ${p.surfaceDeep} 70%)`;
}

function scorebugDetails(p: Preset) {
  switch (p.id) {
    case 'atelier': return `& .team-code, & .team-gold, & .team-kills, & .game-clock { font-weight: 700; } & .objective-row { font-weight: 700; }`;
    case 'voltage': return `& .team-kills { text-shadow: 0 0 5px ${p.blue}; } & .scorebug-center .team-kills:nth-child(3) { text-shadow: 0 0 5px ${p.red}; } & .objective-row-blue { color: ${p.blue}; } & .objective-row-red { color: ${p.red}; }`;
    case 'pulse': return `& .objective-row { font-weight: 900; }`;
    case 'crown': return `& .team-kills { color: ${p.white}; } & .scorebug-center { border-top: 2px solid ${p.line}; border-bottom: 2px solid ${p.line}; }`;
    case 'offset': return `& .team-code { text-transform: uppercase; } & .objective-row-blue { color: ${p.blue}; } & .objective-row-red { color: ${p.red}; }`;
    case 'foundry': return `& .objective-row { background: ${p.surfaceDeep}; }`;
  }
}

function styleRoster(layer: LolPlayerRosterLayer, p: Preset) {
  const side = layer.team;
  const accent = side === 'blue' ? p.blue : p.red;
  const existing = layer.style?.customCss ?? '';
  layer.style = {
    backgroundColor: p.surfaceDeep, color: p.white, borderColor: p.line,
    borderWidth: p.id === 'atelier' || p.id === 'offset' ? 0 : 1,
    customCss: `${existing}
& .player-roster { background: ${p.surfaceDeep}; font-family: ${p.font}; }
& .roster-row { background: ${rowField(p, side)}; border-bottom: ${rowBorder(p, accent)}; }
& .roster-row:nth-child(even) { background: ${evenRowField(p, side)}; }
& .roster-portrait { border: ${p.id === 'offset' ? '0' : p.id === 'crown' ? `2px solid ${p.line}` : `2px solid ${accent}`}; background: ${p.surface}; ${portraitShape(p)} }
& .roster-level { color: ${p.white}; font-family: ${p.display}; text-shadow: 0 1px 2px #000, 1px 0 2px #000; }
& .roster-name { color: ${p.white}; font-family: ${p.display}; ${p.id === 'crown' ? 'font-size: clamp(12px, 3cqw, 19px);' : ''} }
& .roster-stat { color: ${p.id === 'offset' ? accent : p.white}; font-family: ${p.display}; text-shadow: 0 1px 2px #000; }
& .roster-kda { color: ${p.muted}; font-family: ${p.font}; text-shadow: 0 1px 2px #000; }
& .item-slot { border: 1px solid ${slotBorder(p, accent)}; background: ${p.ink}; box-shadow: none; }
${rosterDetails(p, side)}
`,
  };
}

function rowField(p: Preset, side: 'blue' | 'red') {
  const accent = side === 'blue' ? p.blue : p.red;
  if (p.id === 'atelier') return '#23383a';
  if (p.id === 'voltage') return `linear-gradient(90deg, color-mix(in srgb, ${accent} 16%, #081320), #081320 65%)`;
  if (p.id === 'pulse') return broadcastRowSurface('team-gradient', accent, p.surface, '#0a2046');
  if (p.id === 'crown') return 'linear-gradient(90deg, #322942, #191625)';
  if (p.id === 'offset') return broadcastRowSurface('alternating', accent, '#252829', '#1c2021');
  return '#202a2f';
}

function evenRowField(p: Preset, side: 'blue' | 'red') {
  const accent = side === 'blue' ? p.blue : p.red;
  if (p.id === 'atelier') return '#1b3033';
  if (p.id === 'offset') return broadcastRowSurface('alternating', accent, '#252829', '#1c2021', true);
  if (p.id === 'foundry') return '#192227';
  return `linear-gradient(90deg, color-mix(in srgb, ${accent} 10%, ${p.surfaceDeep}), ${p.surfaceDeep} 80%)`;
}

function rowBorder(p: Preset, accent: string) {
  if (p.id === 'atelier') return '1px solid rgb(220 238 234 / 22%)';
  if (p.id === 'offset') return '1px solid #4b5550';
  if (p.id === 'foundry') return '1px solid #48575b';
  return `1px solid color-mix(in srgb, ${accent} 50%, transparent)`;
}

function portraitShape(p: Preset) {
  if (p.id === 'crown') return 'clip-path: polygon(10% 0, 90% 0, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0 90%, 0 10%);';
  if (p.id === 'voltage') return 'clip-path: polygon(0 0, 80% 0, 100% 20%, 100% 100%, 0 100%);';
  return '';
}

function slotBorder(p: Preset, accent: string) {
  if (p.id === 'atelier') return '#749493';
  if (p.id === 'foundry') return p.line;
  return accent;
}

function rosterDetails(p: Preset, side: 'blue' | 'red') {
  const accent = side === 'blue' ? p.blue : p.red;
  switch (p.id) {
    case 'atelier': return `& .roster-name, & .roster-stat, & .roster-kda { font-weight: 700; text-shadow: none; } & .roster-name { font-size: clamp(13px, 3.1cqw, 20px); } & .roster-stat { color: ${accent}; }`;
    case 'voltage': return `& .roster-stat { color: ${accent}; }`;
    case 'pulse': return `& .roster-stat { color: ${accent}; } & .roster-name { text-transform: uppercase; font-family: Impact, 'Arial Narrow', Arial, sans-serif; font-size: clamp(12px, 2.8cqw, 18px); }`;
    case 'crown': return `& .roster-stat { color: ${accent}; }`;
    case 'offset': return `& .roster-name { text-transform: uppercase; font-family: Impact, 'Arial Narrow', Arial, sans-serif; font-size: clamp(12px, 2.8cqw, 18px); } & .roster-stat { font-size: clamp(13px, 3.4cqw, 22px); }`;
    case 'foundry': return `& .roster-stat { color: ${accent}; } & .roster-name { text-transform: uppercase; }`;
  }
}

function styleText(layer: TextLayer, p: Preset, key: string) {
  layer.color = p.white;
  layer.fontFamily = p.display;
  layer.style = { ...layer.style, color: p.white, borderColor: p.line, textShadow: '0 1px 3px rgb(0 0 0 / 58%)' };
  if (p.id === 'atelier') {
    layer.fontWeight = 700;
    layer.style.textShadow = 'none';
  }

  if (key.includes('baron-timer-') || key.includes('dragon-timer-')) {
    layer.style.backgroundColor = timerField(p);
    layer.style.borderWidth = p.id === 'offset' ? 0 : 1;
    layer.style.customCss = timerDetails(p);
  } else if (key.includes('event-name-')) {
    layer.text = p.event;
    layer.name = p.event;
    layer.style.backgroundColor = eventField(p);
    layer.style.borderWidth = p.id === 'offset' ? 0 : 1;
    layer.style.customCss = eventDetails(p);
  } else if (key.includes('left-broadcast-label-')) {
    layer.text = p.footer.split(' ')[0];
    layer.name = `${p.footer} title`;
    layer.fontSize = p.id === 'crown' ? 36 : p.id === 'atelier' ? 37 : 40;
    layer.style.customCss = p.id === 'offset' ? '& .text-layer { transform: skewX(-7deg); }' : '';
  } else if (key.includes('left-round-')) {
    layer.text = p.round;
    layer.name = `${p.round} round`;
    layer.fontFamily = p.font;
    layer.color = p.muted;
  } else if (key.includes('left-series-')) {
    layer.text = p.series;
    layer.name = `${p.series} series`;
    layer.fontSize = p.id === 'crown' ? 17 : 18;
    layer.style.customCss = `& { border-top: 1px solid ${p.line}; padding-top: 4px; }`;
  } else if (key.includes('left-partner-')) {
    layer.text = p.footer;
    layer.name = `${p.footer} footer`;
    layer.fontSize = p.id === 'crown' ? 20 : 23;
    layer.style.backgroundColor = footerField(p);
    layer.style.borderWidth = p.id === 'offset' ? 0 : 1;
    if (p.id === 'offset') layer.color = p.ink;
    if (p.id === 'foundry') layer.color = p.blue;
  }
}

function timerField(p: Preset) {
  if (p.id === 'atelier') return '#20383e';
  if (p.id === 'offset') return '#252829';
  if (p.id === 'foundry') return p.surface;
  return `linear-gradient(90deg, ${p.surface}, ${p.surfaceDeep})`;
}

function timerDetails(p: Preset) {
  if (p.id === 'voltage') return `&::before { content: ''; position: absolute; inset: 2px; border: 1px solid ${p.blue}; clip-path: polygon(0 0, 75% 0, 100% 30%, 100% 100%, 0 100%); }`;
  if (p.id === 'crown') return `&::before { content: ''; position: absolute; inset: 4px; border: 1px solid ${p.line}; }`;
  return '';
}

function eventField(p: Preset) {
  if (p.id === 'atelier') return '#20383b';
  if (p.id === 'pulse') return `linear-gradient(90deg, ${p.blue}, #0c2450 28% 72%, ${p.red})`;
  if (p.id === 'offset') return `linear-gradient(90deg, ${p.blue} 0 2%, #1c1e20 2% 98%, ${p.red} 98%)`;
  if (p.id === 'foundry') return p.surface;
  return `linear-gradient(90deg, ${p.surface}, ${p.surfaceDeep}, ${p.surface})`;
}

function eventDetails(p: Preset) {
  if (p.id === 'crown') return `&::before, &::after { content: ''; position: absolute; top: 50%; width: 22%; height: 1px; background: ${p.line}; } &::before { left: 6%; } &::after { right: 6%; }`;
  return '';
}

function footerField(p: Preset) {
  if (p.id === 'offset') return p.blue;
  if (p.id === 'foundry') return '#263238';
  return p.surface;
}

function styleShape(layer: ShapeLayer, p: Preset, key: string) {
  if (key.includes('roster-divider-')) {
    layer.width = 2;
    layer.style = {
      backgroundColor: p.id === 'offset' ? '#82917c' : p.line,
      borderWidth: 0,
    };
  } else if (key.includes('roster-plate-')) {
    layer.style = {
      backgroundColor: plateField(p), borderColor: p.line,
      borderWidth: 1,
      boxShadow: '0 -12px 28px rgb(0 0 0 / 58%)',
    };
  } else if (key.includes('left-info-')) {
    layer.style = {
      backgroundColor: infoField(p), borderColor: p.line,
      borderWidth: 1,
      boxShadow: '0 -8px 24px rgb(0 0 0 / 45%)',
      customCss: infoDetails(p),
    };
  }
}

function plateField(p: Preset) {
  if (p.id === 'atelier') return '#16292c';
  if (p.id === 'voltage') return 'linear-gradient(145deg, rgb(5 24 37 / 98%), rgb(19 9 35 / 98%))';
  if (p.id === 'pulse') return '#0b2143';
  if (p.id === 'crown') return '#211b2d';
  if (p.id === 'offset') return '#1c2021';
  return p.surfaceDeep;
}

function infoField(p: Preset) {
  if (p.id === 'atelier') return '#1d3437';
  if (p.id === 'voltage') return 'linear-gradient(145deg, #0a3b48, #081322 50%, #34102e)';
  if (p.id === 'pulse') return '#14365e';
  if (p.id === 'crown') return 'linear-gradient(155deg, #362d45, #1b1726 65%)';
  if (p.id === 'offset') return '#222627';
  return p.surface;
}

function infoDetails(p: Preset) {
  if (p.id === 'crown') return `&::before { content: ''; position: absolute; inset: 8px; border: 1px solid ${p.line}; pointer-events: none; }`;
  return '';
}

function styleImage(layer: ImageLayer, p: Preset, key: string) {
  if (key.includes('blue-team-logo-')) layer.src = teamMark('KC', p, p.blue);
  if (key.includes('red-team-logo-')) layer.src = teamMark('MKOI', p, p.red);
  if (key.includes('broadcast-crest-')) layer.src = eventMark(p);
}

function teamMark(code: string, p: Preset, accent: string) {
  const safe = code.replace(/[^A-Z0-9]/g, '');
  const shape = p.id === 'crown'
    ? '<path d="M50 3 95 25 85 85 50 99 15 85 5 25z"/>'
    : p.id === 'offset'
      ? '<path d="M6 8h88v64L68 94H6z"/>'
      : p.id === 'atelier'
        ? '<circle cx="50" cy="50" r="45"/>'
        : '<path d="M18 4h64l15 18v56L82 96H18L3 78V22z"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="${p.surfaceDeep}" stroke="${accent}" stroke-width="5">${shape}</g><text x="50" y="61" text-anchor="middle" font-family="Arial,sans-serif" font-size="${safe.length > 2 ? 25 : 40}" font-weight="900" fill="${p.white}">${safe}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function eventMark(p: Preset) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 4 92 27v46L50 96 8 73V27z" fill="none" stroke="${p.line}" stroke-width="3"/><path d="M50 17 80 33v34L50 83 20 67V33z" fill="${p.surface}" stroke="${p.blue}" stroke-width="3"/><text x="50" y="67" text-anchor="middle" font-family="Arial,sans-serif" font-size="51" font-weight="900" fill="${p.white}">${p.crest}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
