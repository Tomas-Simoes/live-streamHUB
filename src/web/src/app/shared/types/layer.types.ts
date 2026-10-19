export type Vector2 = {
  x: number,
  y: number
}

export enum LayerType {
  Text = 'Text',
  Shape = 'Shape',
  Image = 'Image',
  Video = 'Video',
  Kills = 'Kills',
  Towers = 'Towers',
  VoidGrubs = 'VoidGrubs',
  RiftHerald = 'RiftHerald',
  Dragon = 'Dragon',
  TeamGold = 'TeamGold',
  GoldDiff = 'GoldDiff',
  PlayerScore = 'PlayerScore',
  PlayerCreepScore = 'PlayerCreepScore',
  PlayerGold = 'PlayerGold',
  PlayerItems = 'PlayerItems',
  PlayerName = 'PlayerName',
  PlayerLevel = 'PlayerLevel',
  ChampionName = 'ChampionName',
  ChampionPortrait = 'ChampionPortrait',
  LolScorebug = 'LolScorebug',
  LolPlayerRoster = 'LolPlayerRoster',
  Time = 'Time',
  Group = 'Group',
}

export type StatLayerTeam = 'blue' | 'red';
export type PlayerScoreRole = 'top' | 'jungle' | 'mid' | 'adc' | 'support';
export type TextAlign = 'left' | 'center' | 'right';
export type ImageFit = 'cover' | 'contain' | 'fill';
export type ChampionPortraitShape = 'square' | 'circle' | 'banner';
export type RosterOrientation = 'left' | 'right';

export type LayerVisualStyle = {
  backgroundColor?: string;
  color?: string;
  opacity?: number;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  boxShadow?: string;
  textShadow?: string;
  customCss?: string;
};

export type ComponentPartStyle = Omit<LayerVisualStyle, 'customCss'> & {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  letterSpacing?: number;
  textAlign?: TextAlign;
};

export type Layer<TType extends LayerType = LayerType> = {
  id: string;
  name: string;
  type: TType;
  visible: boolean;
  groupId?: string | null;
  position: Vector2
  width: number,
  height: number,
  style?: LayerVisualStyle;
};

export type TextLayer = Layer<LayerType.Text> & {
  text: string;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  color: string;
  fontWeight?: number;
  letterSpacing?: number;
  textAlign?: TextAlign;
  lineHeight?: number;
  uppercase?: boolean;
};

export type ShapeLayer = Layer<LayerType.Shape> & {};

export type ImageLayer = Layer<LayerType.Image> & {
  src: string;
  mediaKey?: string;
  mediaStorage?: 'r2' | 'local';
  mediaUploadStatus?: 'uploading' | 'ready' | 'failed';
  localFilePath?: string;
  alt: string;
  opacity: number;
  fit?: ImageFit;
  objectPosition?: string;
};

export type VideoLayer = Layer<LayerType.Video> & {
  src: string;
  mediaKey?: string;
  mediaStorage?: 'r2' | 'local';
  mediaUploadStatus?: 'uploading' | 'ready' | 'failed';
  localFilePath?: string;
  autoplay: boolean;
  muted: boolean;
  fit?: ImageFit;
  objectPosition?: string;
};

export type KillsLayer = Layer<LayerType.Kills> & {
  team: StatLayerTeam;
};

export type TowersLayer = Layer<LayerType.Towers> & {
  team: StatLayerTeam;
};

export type VoidGrubsLayer = Layer<LayerType.VoidGrubs> & {
  team: StatLayerTeam;
};

export type RiftHeraldLayer = Layer<LayerType.RiftHerald> & {
  team: StatLayerTeam;
};

export type DragonLayer = Layer<LayerType.Dragon> & {
  team: StatLayerTeam;
};

export type TeamGoldLayer = Layer<LayerType.TeamGold> & {
  team: StatLayerTeam;
};

export type GoldDiffLayer = Layer<LayerType.GoldDiff> & {};

export type PlayerScoreLayer = Layer<LayerType.PlayerScore> & {
  team: StatLayerTeam;
  role: PlayerScoreRole;
};

export type PlayerCreepScoreLayer = Layer<LayerType.PlayerCreepScore> & {
  team: StatLayerTeam;
  role: PlayerScoreRole;
};

export type PlayerGoldLayer = Layer<LayerType.PlayerGold> & {
  team: StatLayerTeam;
  role: PlayerScoreRole;
};

export type PlayerItemsLayer = Layer<LayerType.PlayerItems> & {
  team: StatLayerTeam;
  role: PlayerScoreRole;
  showTrinket: boolean;
};

export type PlayerNameLayer = Layer<LayerType.PlayerName> & {
  team: StatLayerTeam;
  role: PlayerScoreRole;
};

export type PlayerLevelLayer = Layer<LayerType.PlayerLevel> & {
  team: StatLayerTeam;
  role: PlayerScoreRole;
};

export type ChampionNameLayer = Layer<LayerType.ChampionName> & {
  team: StatLayerTeam;
  role: PlayerScoreRole;
};

export type ChampionPortraitLayer = Layer<LayerType.ChampionPortrait> & {
  team: StatLayerTeam;
  role: PlayerScoreRole;
  shape: ChampionPortraitShape;
  showLevel: boolean;
};

export type LolScorebugLayer = Layer<LayerType.LolScorebug> & {
  partStyles?: Record<string, ComponentPartStyle>;
  blueTeamCode: string;
  redTeamCode: string;
  blueAccent: string;
  redAccent: string;
  showGold: boolean;
  showObjectives: boolean;
  showGameTime: boolean;
  gameTime?: string;
  teamStats?: Partial<Record<StatLayerTeam, {
    seed?: string;
    kills?: number;
    gold?: number;
    towers?: number;
    dragons?: number;
    voidGrubs?: number;
    riftHerald?: number;
  }>>;
};

export type RosterPlayerOverride = {
  name?: string;
  championName?: string;
  championId?: string;
  championImageUrl?: string;
  level?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  creepScore?: number;
  gold?: number;
  items?: Array<number | null>;
  visible?: boolean;
};

export type LolPlayerRosterLayer = Layer<LayerType.LolPlayerRoster> & {
  partStyles?: Record<string, ComponentPartStyle>;
  team: StatLayerTeam;
  orientation: RosterOrientation;
  showChampion: boolean;
  showLevel: boolean;
  showKda: boolean;
  showCs: boolean;
  showGold: boolean;
  showItems: boolean;
  playerOverrides?: Partial<Record<PlayerScoreRole, RosterPlayerOverride>>;
};

export type TimeLayer = Layer<LayerType.Time> & {};

export type StatLayer =
  | KillsLayer
  | TowersLayer
  | VoidGrubsLayer
  | RiftHeraldLayer
  | DragonLayer
  | TeamGoldLayer
  | GoldDiffLayer
  | PlayerScoreLayer
  | PlayerCreepScoreLayer
  | PlayerGoldLayer
  | PlayerItemsLayer
  | PlayerNameLayer
  | PlayerLevelLayer
  | ChampionNameLayer
  | ChampionPortraitLayer
  | LolScorebugLayer
  | LolPlayerRosterLayer
  | TimeLayer;

export type GroupLayer = Layer<LayerType.Group> & {
  collapsed: boolean;
};

export type EditorLayer =
  | TextLayer
  | ShapeLayer
  | ImageLayer
  | VideoLayer
  | KillsLayer
  | TowersLayer
  | VoidGrubsLayer
  | RiftHeraldLayer
  | DragonLayer
  | TeamGoldLayer
  | GoldDiffLayer
  | PlayerScoreLayer
  | PlayerCreepScoreLayer
  | PlayerGoldLayer
  | PlayerItemsLayer
  | PlayerNameLayer
  | PlayerLevelLayer
  | ChampionNameLayer
  | ChampionPortraitLayer
  | LolScorebugLayer
  | LolPlayerRosterLayer
  | TimeLayer
  | GroupLayer;
