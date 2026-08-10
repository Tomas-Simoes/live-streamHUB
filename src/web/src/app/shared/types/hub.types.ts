import { EditorLayer, Vector2 } from "./layer.types";
import { User } from "./user.types";

export type HubImage = {
    imgUrl: string,
    htmlId: string,
    position: Vector2,
}

export type HubFeature = {
    feature: string,
    htmlId: string,
    position: Vector2,
}

export type HubResponse = {
    _id: string,
    hubName: string,
    user?: string | User,
    imgs?: HubImage[],
    features?: HubFeature[],
    layout?: Record<string, any> | null,
}

export type CreateHubRequest = {
    hubName: string,
    imgs?: HubImage[],
    features?: HubFeature[],
    layout?: Record<string, any>,
}

export type UpdateHubRequest = Partial<CreateHubRequest>

export type Hub = {
    _id: string,
    hubName: string,
    layers: EditorLayer[],
    user?: string | User,
    imgs?: HubImage[],
    features?: HubFeature[],
    layout?: Record<string, any> | null,
}
