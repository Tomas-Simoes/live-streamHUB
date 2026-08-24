import { Injectable, computed, signal } from "@angular/core";

import { CANVAS_SIZE } from "./canvas-coordinates";
import {
  EditorLayer,
  Layer,
  LayerType,
  Vector2,
} from "../../../shared/types/layer.types";
import { OBS_TEXT_DEFAULT_FONT } from "../../../shared/constants/obs-fonts.const";
import { HubStore } from "../../../core/store/hub.store";

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
      name: getDefaultLayerName(type),
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
          fontFamily: OBS_TEXT_DEFAULT_FONT,
          bold: false,
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
          width: 120,
          height: 48,
          team: "blue",
        };
        break;
      case LayerType.Towers:
        layer = {
          ...baseLayer,
          type: LayerType.Towers,
          width: 120,
          height: 48,
          team: "blue",
        };
        break;
      case LayerType.VoidGrubs:
        layer = {
          ...baseLayer,
          type: LayerType.VoidGrubs,
          width: 120,
          height: 48,
          team: "blue",
        };
        break;
      case LayerType.RiftHerald:
        layer = {
          ...baseLayer,
          type: LayerType.RiftHerald,
          width: 120,
          height: 48,
          team: "blue",
        };
        break;
      case LayerType.Dragon:
        layer = {
          ...baseLayer,
          type: LayerType.Dragon,
          width: 120,
          height: 48,
          team: "blue",
        };
        break;
      case LayerType.PlayerScore:
        layer = {
          ...baseLayer,
          type: LayerType.PlayerScore,
          width: 140,
          height: 48,
          team: "blue",
          role: "top",
        };
        break;
      case LayerType.Time:
        layer = {
          ...baseLayer,
          type: LayerType.Time,
          width: 120,
          height: 48,
        };
        break;
      case LayerType.Group:
        layer = {
          ...baseLayer,
          type: LayerType.Group,
          collapsed: false,
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

  removeLayer(layerId: string) {
    const removed = this.hubStore.removeLayer(layerId);

    if (removed && this.selectedLayerId() === layerId) {
      this.selectLayer(null);
    }

    return removed;
  }

  renameLayer(layerId: string, name: string) {
    this.hubStore.updateLayer(layerId, {
      name,
    });
  }

  setLayerGroup(layerId: string, groupId: string | null) {
    const selectedHub = this.hubStore.selectedHub();

    if (!selectedHub) {
      return false;
    }

    const layer = selectedHub.layers.find((layer) => layer.id === layerId);

    if (!layer || layer.type === LayerType.Group) {
      return false;
    }

    const normalizedGroupId =
      groupId &&
      selectedHub.layers.some(
        (layer) => layer.id === groupId && layer.type === LayerType.Group,
      )
        ? groupId
        : null;

    if ((layer.groupId ?? null) === normalizedGroupId) {
      return false;
    }

    return this.hubStore.updateLayer(layerId, {
      groupId: normalizedGroupId,
    });
  }

  toggleGroupCollapsed(layerId: string) {
    const selectedHub = this.hubStore.selectedHub();
    const layer = selectedHub?.layers.find((layer) => layer.id === layerId);

    if (!layer || layer.type !== LayerType.Group) {
      return false;
    }

    return this.hubStore.updateLayer(layer.id, {
      collapsed: !layer.collapsed,
    });
  }
}

function getDefaultLayerName(type: LayerType) {
  switch (type) {
    case LayerType.Kills:
    case LayerType.Towers:
    case LayerType.VoidGrubs:
    case LayerType.RiftHerald:
    case LayerType.Dragon:
      return "0";
    default:
      return "New " + getLayerTypeLabel(type);
  }
}

function getLayerTypeLabel(type: LayerType) {
  switch (type) {
    case LayerType.VoidGrubs:
      return "Void Grubs";
    case LayerType.RiftHerald:
      return "Rift Herald";
    case LayerType.PlayerScore:
      return "Player Score";
    case LayerType.Time:
      return "Time";
    default:
      return type;
  }
}
