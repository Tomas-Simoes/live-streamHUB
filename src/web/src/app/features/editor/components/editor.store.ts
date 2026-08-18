import { Injectable, computed, signal } from "@angular/core";

import { CANVAS_SIZE } from "./canvas-coordinates";
import {
  EditorLayer,
  Layer,
  LayerType,
  Vector2,
} from "../../../shared/types/layer.types";
import { HubStore } from "../../../core/hub.store";

@Injectable()
export class EditorStore {
  constructor(private hubStore: HubStore) {}

  selectedLayerId = signal<string | null>(null);
  selectedLayer = computed(() => {
    const selectedLayerId = this.selectedLayerId();
    const selectedHub = this.hubStore.selectedHub();

    if (!selectedHub || selectedLayerId === null) {
      return null;
    }

    return selectedHub.layers.find((layer) => layer.id === selectedLayerId);
  });

  createLayer(type: LayerType) {
    const baseLayer: Layer = {
      id: crypto.randomUUID(),
      name: "New " + type,
      type,
      visible: true,
      position: { x: CANVAS_SIZE.width / 2, y: CANVAS_SIZE.height / 2 },
      width: 200,
      height: 200,
    };
    let layer: EditorLayer;

    switch (type) {
      case LayerType.Text:
        layer = {
          ...baseLayer,
          type: LayerType.Text,
          width: 170,
          height: 48,
          text: "New text",
          fontSize: 32,
          fontFamily: "Inter",
          color: "#edbd95",
        };
        break;
      case LayerType.Image:
        layer = {
          ...baseLayer,
          type: LayerType.Image,
          src: "",
          alt: "",
          opacity: 100,
        };
        break;
      case LayerType.Video:
        layer = {
          ...baseLayer,
          type: LayerType.Video,
          src: "",
          autoplay: true,
          muted: true,
        };
        break;
      case LayerType.Kills:
        layer = {
          ...baseLayer,
          type: LayerType.Kills,
        };
        break;
      case LayerType.Towers:
        layer = {
          ...baseLayer,
          type: LayerType.Towers,
        };
        break;
      case LayerType.Group:
        layer = {
          ...baseLayer,
          type: LayerType.Group,
        };
        break;
    }

    this.selectLayer(layer.id);
    return layer;
  }

  selectLayer(layerId: string | null) {
    this.selectedLayerId.set(layerId);
  }

  moveLayer(layerId: string, position: Vector2) {
    this.hubStore.updateLayer(layerId, {
      position,
    });
  }

  resizeLayer(
    layerId: string,
    size: Pick<Layer, "position" | "width" | "height">,
  ) {
    this.hubStore.updateLayer(layerId, size);
  }

  updateLayer(layerId: string, changes: Partial<EditorLayer>) {
    this.hubStore.updateLayer(layerId, changes);
  }

  renameLayer(layerId: string, name: string) {
    this.hubStore.updateLayer(layerId, {
      name,
    });
  }
}
