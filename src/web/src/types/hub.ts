export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;

export type HubElementType = 'image' | 'text' | 'data-widget';
export type TeamSide = 'blue' | 'red';

export interface HubCanvas {
  width: number;
  height: number;
}

export interface HubElementStyle {
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  objectFit?: 'cover' | 'contain' | 'fill';
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
  opacity?: number;
  padding?: number;
  textTransform?: 'none' | 'uppercase';
  textShadow?: string;
  boxShadow?: string;
}

export interface HubElementContent {
  text?: string;
  src?: string;
  label?: string;
  showLabel?: boolean;
  prefix?: string;
  suffix?: string;
}

export interface HubElement {
  id: string;
  name: string;
  type: HubElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex: number;
  style: HubElementStyle;
  content: HubElementContent;
  dataBinding?: string;
  locked?: boolean;
  hidden?: boolean;
}

export interface HubLayout {
  id: string;
  backendId?: string;
  hubName: string;
  game: string;
  canvas: HubCanvas;
  elements: HubElement[];
  updatedAt: string;
}

export interface TeamState {
  name: string;
  gold: number;
  kills: number;
  minions: number;
  objectives: number;
}

export interface PlayerState {
  id: string;
  name: string;
  team: TeamSide;
  championName: string;
  characterName: string;
  kills: number;
  deaths: number;
  assists: number;
  gold: number;
  minions: number;
  items: string[];
}

export interface NormalizedGameState {
  source: 'backend' | 'mock' | 'overwolf';
  connected: boolean;
  game: {
    time: number;
    mode: string;
    map: string;
    phase: string;
  };
  team: Record<TeamSide, TeamState>;
  player: PlayerState[];
  events: {
    latest: string;
    feed: string[];
  };
  updatedAt: string;
}

export interface DataBindingDefinition {
  key: string;
  label: string;
  group: string;
  format: 'text' | 'number' | 'gold' | 'time';
  defaultSize: {
    width: number;
    height: number;
  };
}

export interface SaveResult {
  hub: HubLayout;
  target: 'backend' | 'local';
  message: string;
}
