import { EditorLayer, ImageLayer, LayerType, LolPlayerRosterLayer, LolScorebugLayer, ShapeLayer, StatLayerTeam, TextLayer } from '../types/layer.types';

const CREAM = '#f1e8d8';
const MUTED = '#bd9e8f';
const LINE = 'rgb(238 213 190 / 38%)';

export function createLeagueBroadcastHubLayout() {
  return createCblolBroadcastHubLayout();
}

export function createCblolBroadcastHubLayout() {
  // Earlier layers render in front in both the editor and hub previews.
  const layers: EditorLayer[] = [
    image('blue-team-logo', 'Blue team logo', teamMark('KC'), 385, 39, 49, 49),
    image('red-team-logo', 'Red team logo', teamMark('MKOI'), 1535, 39, 49, 49),
    scorebug(),
    textLayer('baron-timer', '3:31', 88, 32, 84, 40, 22, CREAM, timerStyle()),
    textLayer('dragon-timer', '3:32', 184, 32, 84, 40, 22, CREAM, timerStyle()),

    textLayer('event-name', 'CBLOL 2026  /  PLAYOFFS', 960, 805, 1200, 30, 20, CREAM, {
      backgroundColor: '#4b100d', borderColor: LINE, borderWidth: 1,
      fontFamily: 'Impact, Arial Narrow, sans-serif',
    }),
    image('broadcast-crest', 'CBLOL broadcast crest', cblolCrest(), 160, 995, 45, 45),
    textLayer('left-broadcast-label', 'CBLOL', 160, 862, 278, 52, 44, CREAM, {
      fontFamily: 'Impact, Arial Narrow, sans-serif',
      textShadow: '0 2px 8px rgb(0 0 0 / 60%)',
    }),
    textLayer('left-round', 'QUARTAS DE FINAL', 160, 900, 278, 25, 16, MUTED, {
      fontFamily: 'Arial Narrow, Arial, sans-serif',
    }),
    textLayer('left-series', 'GAME 01  /  BO5', 160, 950, 278, 25, 18, CREAM, {
      fontFamily: 'Impact, Arial Narrow, sans-serif',
    }),
    textLayer('left-partner', 'CBLOL 2026', 160, 1043, 278, 36, 24, CREAM, {
      backgroundColor: '#731b13', borderColor: LINE, borderWidth: 1,
      fontFamily: 'Impact, Arial Narrow, sans-serif',
    }),
    roster('blue', 'left', 660, blueRosterCss()),
    roster('red', 'right', 1260, redRosterCss()),
    shape('roster-divider', 'Player scoreboard divider', 960, 950, 6, 260, {
      backgroundColor: '#8b2a1c', borderColor: CREAM, borderWidth: 1,
      customCss: '&::after { content: ""; position: absolute; inset: 0 2px; background: #e9d6bd; opacity: .6; }',
    }),
    shape('roster-plate', 'Player scoreboard background', 960, 935, 1200, 290, {
      backgroundColor: 'linear-gradient(180deg, rgb(71 15 12 / 96%), rgb(16 7 9 / 98%))',
      borderColor: LINE, borderWidth: 2, boxShadow: '0 -12px 28px rgb(0 0 0 / 58%)',
      customCss: '&::before { content: ""; position: absolute; inset: 4px; border: 1px solid rgb(239 214 189 / 25%); pointer-events: none; }',
    }),
    shape('left-info', 'Tournament information panel', 160, 935, 320, 290, panelStyle()),
  ];

  return { id: 'cblol-broadcast-hub', templateId: 'cblol-broadcast', backgroundId: 'league-of-legends-clean', layers };
}

function scorebug(): LolScorebugLayer {
  return {
    id: id('scorebug'), name: 'CBLOL team scoreboard', type: LayerType.LolScorebug,
    visible: true, groupId: null, position: { x: 960, y: 50 }, width: 1200, height: 100,
    blueTeamCode: 'KC', redTeamCode: 'MKOI', blueAccent: '#8e2b22', redAccent: '#b45c39',
    showGold: true, showObjectives: true, showGameTime: true,
    style: {
      color: CREAM, borderColor: LINE, borderWidth: 2,
      boxShadow: '0 11px 30px rgb(0 0 0 / 65%)',
      customCss: `
& { clip-path: polygon(1.6% 0, 98.4% 0, 100% 100%, 0 100%); }
& .scorebug { background: transparent; font-family: 'Arial Narrow', Arial, sans-serif; }
& .scorebug-team { gap: 2%; padding: 0 2.5%; background: transparent; }
& .scorebug-team-blue { border-left: 6px double #e5c9ae; background: linear-gradient(90deg, #6c1c14, #240b0d); }
& .scorebug-team-red { border-right: 6px double #e5c9ae; background: linear-gradient(90deg, #240b0d, #6c1c14); }
& .team-logo { flex-basis: 13%; width: 13%; aspect-ratio: 1; visibility: hidden; }
& .team-lockup { flex: 1 1 19%; min-width: 0; }
& .team-code { color: ${CREAM}; font-family: Impact, 'Arial Narrow', sans-serif; font-size: clamp(12px, 3.25cqw, 29px); }
& .team-seed { color: ${MUTED}; font-size: clamp(6px, 1.1cqw, 10px); }
& .team-gold { color: ${CREAM}; font-family: Impact, 'Arial Narrow', sans-serif; font-size: clamp(10px, 2.65cqw, 25px); }
& .team-objective { min-width: 2.2em; color: ${CREAM}; font-size: clamp(7px, 1.8cqw, 17px); }
& .scorebug-center { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: minmax(0, 1fr) 29%; gap: 0; padding: 0; place-items: center; background: linear-gradient(180deg, #180a0c 0 71%, #150a0c 71%); }
& .team-kills { min-width: 0; color: ${CREAM}; font-family: Impact, 'Arial Narrow', sans-serif; font-size: clamp(23px, 4.4cqw, 48px); line-height: 1; transform: translateY(3px); }
& .scorebug-center .team-kills:first-child { grid-column: 1; grid-row: 1; }
& .scorebug-center .team-kills:nth-child(3) { grid-column: 2; grid-row: 1; }
& .score-divider { display: none; }
& .game-clock { position: static; grid-column: 1 / -1; grid-row: 2; width: 100%; height: 100%; min-width: 0; display: grid; place-items: center; padding: 0; transform: none; border: 0; background: transparent; color: ${CREAM}; font-family: Impact, 'Arial Narrow', sans-serif; font-size: clamp(12px, 2.3cqw, 22px); line-height: 1; text-shadow: 0 2px 4px #100405; }
& .objective-row { gap: 6%; padding: 0 5%; background: #150a0c; color: #dbc3ae; font-size: clamp(7px, 1.3cqw, 12px); opacity: 1; }
& .objective-row-blue, & .objective-row-red { border-top: 1px solid rgb(239 214 189 / 30%); }
`,
    },
  };
}

function roster(team: StatLayerTeam, orientation: 'left' | 'right', x: number, customCss: string): LolPlayerRosterLayer {
  return {
    id: id(`${team}-roster`), name: `${team === 'blue' ? 'Blue' : 'Red'} player scoreboard`,
    type: LayerType.LolPlayerRoster, visible: true, groupId: null,
    position: { x, y: 950 }, width: 600, height: 260, team, orientation,
    showChampion: true, showLevel: true, showKda: true, showCs: true, showGold: false, showItems: true,
    style: {
      backgroundColor: '#170b0d', color: CREAM, borderColor: 'rgb(238 213 190 / 24%)',
      borderWidth: 1, customCss,
    },
  };
}

function rosterBaseCss() {
  return `
& .player-roster { gap: 0.6%; padding: 0.35%; background: #1b0c0e; font-family: 'Arial Narrow', Arial, sans-serif; }
& .roster-row { grid-template-rows: minmax(0, 1fr); gap: 0.8%; padding: 0.15% 0.6%; background: linear-gradient(90deg, rgb(124 38 27 / 30%), rgb(37 12 14 / 93%)); border-bottom: 1px solid rgb(238 213 190 / 22%); }
& .roster-row:nth-child(even) { background: linear-gradient(90deg, rgb(91 25 21 / 38%), rgb(27 10 12 / 96%)); }
& .roster-portrait { width: auto; height: 100%; aspect-ratio: 1; justify-self: center; border: 2px solid #d3b29a; background: #3e1110; }
& .roster-portrait img { object-fit: contain; object-position: center; }
& .roster-level { grid-row: 1; z-index: 2; align-self: end; justify-self: end; width: 11px; height: 11px; margin-right: 7px; margin-bottom: 3px; border: 0; border-radius: 0; background: transparent; color: ${CREAM}; font-family: 'Arial Narrow', Arial, sans-serif; font-size: 10px; font-weight: 900; line-height: 1; text-shadow: 0 1px 2px #080304, 1px 0 2px #080304; box-shadow: none; }
& .roster-name { grid-row: 1; color: ${CREAM}; font-size: clamp(13px, 3.4cqw, 22px); font-weight: 900; }
& .roster-stat { grid-row: 1; color: #ead0bc; font-size: clamp(12px, 3.2cqw, 21px); font-weight: 900; text-shadow: 0 1px 2px #100405; }
& .roster-kda { grid-row: 1; color: #ead0bc; font-size: clamp(11px, 2.8cqw, 18px); font-weight: 900; text-shadow: 0 1px 2px #100405; }
& .roster-items { grid-row: 1; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 1.2%; align-items: center; }
& .item-slot { width: 100%; aspect-ratio: 1; border: 1px solid #8e6151; background: #301618; box-shadow: 0 0 0 1px #120708 inset; }
& .item-slot img { width: 100%; height: 100%; object-fit: cover; }
`;
}

function blueRosterCss() {
  return rosterBaseCss() + `
& .roster-row { grid-template-columns: 45% 9% 19% 9% 14%; }
& .roster-items { grid-column: 1; }
& .roster-portrait { grid-column: 2; grid-row: 1; }
& .roster-level { grid-column: 2; }
& .roster-name { grid-column: 3; text-align: left; }
& .roster-stat { grid-column: 4; text-align: center; }
& .roster-kda { grid-column: 5; text-align: center; }
`;
}

function redRosterCss() {
  return rosterBaseCss() + `
& .roster-row { grid-template-columns: 14% 9% 19% 9% 45%; }
& .roster-kda { grid-column: 1; text-align: center; }
& .roster-stat { grid-column: 2; text-align: center; }
& .roster-name { grid-column: 3; text-align: right; }
& .roster-level { grid-column: 4; }
& .roster-portrait { grid-column: 4; grid-row: 1; }
& .roster-items { grid-column: 5; }
`;
}

type TextOptions = NonNullable<TextLayer['style']> & { fontFamily?: string };

function timerStyle(): TextOptions {
  return {
    backgroundColor: 'linear-gradient(90deg, #5d1712, #200b0d)', borderColor: LINE, borderWidth: 1,
    fontFamily: 'Impact, Arial Narrow, sans-serif',
    customCss: '&::before { content: ""; position: absolute; left: 7%; top: 35%; width: 12%; aspect-ratio: 1; border: 2px solid #dbc7b4; transform: rotate(45deg); } & .text-layer { padding-left: 17%; }',
  };
}

function panelStyle(): ShapeLayer['style'] {
  return {
    backgroundColor: 'linear-gradient(165deg, #762018, #2b0b0c 48%, #17090a)', borderColor: LINE, borderWidth: 2,
    customCss: '&::before { content: ""; position: absolute; inset: 8px; border: 1px solid rgb(238 213 190 / 28%); } &::after { content: ""; position: absolute; left: 8%; right: 8%; top: 48%; height: 1px; background: rgb(238 213 190 / 40%); }',
  };
}

function shape(suffix: string, name: string, x: number, y: number, width: number, height: number, style: ShapeLayer['style']): ShapeLayer {
  return { id: id(suffix), name, type: LayerType.Shape, visible: true, groupId: null, position: { x, y }, width, height, style };
}

function textLayer(suffix: string, text: string, x: number, y: number, width: number, height: number, fontSize: number, color: string, options: TextOptions = {}): TextLayer {
  const { fontFamily, ...style } = options;
  return {
    id: id(suffix), name: text, type: LayerType.Text, visible: true, groupId: null,
    position: { x, y }, width, height, text, fontSize, fontFamily: fontFamily ?? 'Arial',
    bold: true, color, fontWeight: 900, textAlign: 'center', lineHeight: 1, uppercase: true, style,
  };
}

function image(suffix: string, name: string, src: string, x: number, y: number, width: number, height: number): ImageLayer {
  return {
    id: id(suffix), name, type: LayerType.Image, visible: true, groupId: null,
    position: { x, y }, width, height, src, alt: name, opacity: 100, fit: 'contain', objectPosition: 'center',
  };
}

function teamMark(code: string) {
  const label = code.replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 3 94 18v56L50 97 6 74V18z" fill="#3b0e0d" stroke="#e7cdb4" stroke-width="5"/><path d="M50 11 86 23v46L50 88 14 69V23z" fill="none" stroke="#9d3a2c" stroke-width="3"/><text x="50" y="60" text-anchor="middle" font-family="Arial Narrow,Arial,sans-serif" font-size="${code.length > 2 ? 28 : 41}" font-weight="900" fill="#f1e8d8">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function cblolCrest() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#f1e8d8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M50 8c14 0 20 10 17 19-2 7-9 11-17 11s-15-4-17-11c-3-9 3-19 17-19Z"/><path d="M23 33c-12 5-17 16-13 28l15 22 25 8 25-8 15-22c4-12-1-23-13-28l-10 8-17 15-17-15-10-8Z"/><path d="M15 53c12-4 22 0 28 11l7 12 7-12c6-11 16-15 28-11M33 26c-8-4-16-2-20 6m74 0c-4-8-12-10-20-6"/><path d="M28 67c6-7 13-7 19 0m6 0c6-7 13-7 19 0"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function id(suffix: string) {
  return `cblol-${suffix}-${crypto.randomUUID()}`;
}
