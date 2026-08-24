export type Vector2 = {
  x: number,
  y: number
}

export enum LayerType {
  Text = 'Text',
  Image = 'Image',
  Video = 'Video',
  Kills = 'Kills',
  Towers = 'Towers',
  VoidGrubs = 'VoidGrubs',
  RiftHerald = 'RiftHerald',
  Dragon = 'Dragon',
  PlayerScore = 'PlayerScore',
  Time = 'Time',
  Group = 'Group',
}

export type StatLayerTeam = 'blue' | 'red';
export type PlayerScoreRole = 'top' | 'jungle' | 'mid' | 'adc' | 'support';

export type Layer<TType extends LayerType = LayerType> = {
  id: string;
  name: string;
  type: TType;
  visible: boolean;
  groupId?: string | null;
  position: Vector2
  width: number,
  height: number
};

export type TextLayer = Layer<LayerType.Text> & {
  text: string;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  color: string;
};

export type ImageLayer = Layer<LayerType.Image> & {
  src: string;
  mediaKey?: string;
  mediaStorage?: 'r2' | 'local';
  mediaUploadStatus?: 'uploading' | 'ready' | 'failed';
  localFilePath?: string;
  alt: string;
  opacity: number;
};

export type VideoLayer = Layer<LayerType.Video> & {
  src: string;
  mediaKey?: string;
  mediaStorage?: 'r2' | 'local';
  mediaUploadStatus?: 'uploading' | 'ready' | 'failed';
  localFilePath?: string;
  autoplay: boolean;
  muted: boolean;
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

export type PlayerScoreLayer = Layer<LayerType.PlayerScore> & {
  team: StatLayerTeam;
  role: PlayerScoreRole;
};

export type TimeLayer = Layer<LayerType.Time> & {};

export type StatLayer =
  | KillsLayer
  | TowersLayer
  | VoidGrubsLayer
  | RiftHeraldLayer
  | DragonLayer
  | PlayerScoreLayer
  | TimeLayer;

export type GroupLayer = Layer<LayerType.Group> & {
  collapsed: boolean;
};

export type EditorLayer =
  | TextLayer
  | ImageLayer
  | VideoLayer
  | KillsLayer
  | TowersLayer
  | VoidGrubsLayer
  | RiftHeraldLayer
  | DragonLayer
  | PlayerScoreLayer
  | TimeLayer
  | GroupLayer;
