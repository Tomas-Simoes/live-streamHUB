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
  Group = 'Group',
}

export type Layer<TType extends LayerType = LayerType> = {
  id: string;
  name: string;
  type: TType;
  visible: boolean;
  position: Vector2
  width: number,
  height: number
};

export type TextLayer = Layer<LayerType.Text> & {
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
};

export type ImageLayer = Layer<LayerType.Image> & {
  src: string;
  alt: string;
  opacity: number;
};

export type VideoLayer = Layer<LayerType.Video> & {
  src: string;
  autoplay: boolean;
  muted: boolean;
};

export type KillsLayer = Layer<LayerType.Kills> & {
};

export type TowersLayer = Layer<LayerType.Towers> & {
};

export type GroupLayer = Layer<LayerType.Group> & {
};

export type EditorLayer =
  | TextLayer
  | ImageLayer
  | VideoLayer
  | KillsLayer
  | TowersLayer
  | GroupLayer;
