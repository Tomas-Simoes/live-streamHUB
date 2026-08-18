import { EditorLayer, Vector2 } from "./layer.types";
import { User } from "./user.types";

export type HubImage = {
  imgUrl: string;
  htmlId: string;
  position: Vector2;
};

export type HubFeature = {
  feature: string;
  htmlId: string;
  position: Vector2;
};

export type HubResponse = {
  _id: string;
  hubName: string;
  user?: User | null;
  imgs?: HubImage[];
  features?: HubFeature[];
  layout?: Record<string, any> | null;
};

export type CreateHubRequest = {
  hubName: string;
  imgs?: HubImage[];
  features?: HubFeature[];
  layout?: Record<string, any>;
};

export type UpdateHubRequest = Partial<CreateHubRequest>;

export type Hub = {
  _id: string;
  hubName: string;
  layers: EditorLayer[];
  user?: User | null;
  imgs?: HubImage[];
  features?: HubFeature[];
  layout?: Record<string, any> | null;
};

export type HubCard = {
  name: string;
  category: string;
  description: string;
  features: string[];
  status: string;
};

export type HubEntry = {
  hub: Hub;
  index: number;
  card: HubCard;
};
