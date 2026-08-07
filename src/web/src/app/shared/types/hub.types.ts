import { Layer } from "./layer.types";
import { User } from "./user.types";

export type Hub = {
    layers: Layer[],
    user: User,
}