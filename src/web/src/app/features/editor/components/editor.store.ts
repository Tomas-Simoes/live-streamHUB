import { Injectable, computed, signal } from "@angular/core";

import { CANVAS_SIZE } from "./canvas-coordinates";
import {
  EditorLayer,
  ComponentPartStyle,
  Layer,
  LayerVisualStyle,
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
          fontWeight: 500,
          letterSpacing: 0,
          textAlign: "center",
          lineHeight: 1.15,
          uppercase: false,
        };
        break;
      case LayerType.Shape:
        layer = {
          ...baseLayer,
          type: LayerType.Shape,
          width: 240,
          height: 96,
          style: {
            backgroundColor: "rgb(12 16 28 / 82%)",
            borderColor: "rgb(255 255 255 / 18%)",
            borderWidth: 1,
            borderRadius: 4,
            boxShadow: "0 14px 28px rgb(0 0 0 / 34%)",
          },
        };
        break;
      case LayerType.Image:
        layer = {
          ...baseLayer,
          type: LayerType.Image,
          src: "",
          alt: "",
          opacity: 100,
          fit: "cover",
          objectPosition: "center",
        };
        break;
      case LayerType.Video:
        layer = {
          ...baseLayer,
          type: LayerType.Video,
          src: "",
          autoplay: true,
          muted: true,
          fit: "cover",
          objectPosition: "center",
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
      case LayerType.TeamGold:
        layer = {
          ...baseLayer,
          type: LayerType.TeamGold,
          width: 132,
          height: 46,
          team: "blue",
        };
        break;
      case LayerType.GoldDiff:
        layer = {
          ...baseLayer,
          type: LayerType.GoldDiff,
          width: 132,
          height: 46,
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
      case LayerType.PlayerCreepScore:
        layer = {
          ...baseLayer,
          type: LayerType.PlayerCreepScore,
          width: 96,
          height: 42,
          team: "blue",
          role: "top",
        };
        break;
      case LayerType.PlayerGold:
        layer = {
          ...baseLayer,
          type: LayerType.PlayerGold,
          width: 100,
          height: 42,
          team: "blue",
          role: "top",
        };
        break;
      case LayerType.PlayerItems:
        layer = {
          ...baseLayer,
          type: LayerType.PlayerItems,
          width: 238,
          height: 34,
          team: "blue",
          role: "top",
          showTrinket: true,
        };
        break;
      case LayerType.PlayerName:
        layer = {
          ...baseLayer,
          type: LayerType.PlayerName,
          width: 160,
          height: 42,
          team: "blue",
          role: "top",
        };
        break;
      case LayerType.PlayerLevel:
        layer = {
          ...baseLayer,
          type: LayerType.PlayerLevel,
          width: 48,
          height: 42,
          team: "blue",
          role: "top",
        };
        break;
      case LayerType.ChampionName:
        layer = {
          ...baseLayer,
          type: LayerType.ChampionName,
          width: 150,
          height: 42,
          team: "blue",
          role: "top",
        };
        break;
      case LayerType.ChampionPortrait:
        layer = {
          ...baseLayer,
          type: LayerType.ChampionPortrait,
          width: 76,
          height: 76,
          team: "blue",
          role: "top",
          shape: "square",
          showLevel: true,
        };
        break;
      case LayerType.LolScorebug:
        layer = {
          ...baseLayer,
          type: LayerType.LolScorebug,
          width: 900,
          height: 86,
          position: { x: CANVAS_SIZE.width / 2, y: 44 },
          blueTeamCode: "KC",
          redTeamCode: "MKOI",
          blueAccent: "#34d5e6",
          redAccent: "#ef7d24",
          showGold: true,
          showObjectives: true,
          showGameTime: true,
          style: {
            backgroundColor: "rgb(15 16 32 / 86%)",
            color: "#ffffff",
            borderColor: "rgb(255 255 255 / 18%)",
            borderWidth: 1,
            borderRadius: 2,
            boxShadow: "0 14px 28px rgb(0 0 0 / 34%)",
          },
        };
        break;
      case LayerType.LolPlayerRoster:
        layer = {
          ...baseLayer,
          type: LayerType.LolPlayerRoster,
          width: 620,
          height: 210,
          team: "blue",
          orientation: "left",
          showChampion: true,
          showLevel: true,
          showKda: true,
          showCs: true,
          showGold: true,
          showItems: true,
          style: {
            backgroundColor: "rgb(11 12 18 / 84%)",
            color: "#ffffff",
            borderColor: "rgb(255 255 255 / 16%)",
            borderWidth: 1,
            borderRadius: 3,
            boxShadow: "0 14px 30px rgb(0 0 0 / 38%)",
          },
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

  getLayer(layerId: string) {
    return this.hubStore.selectedHub()?.layers.find((layer) => layer.id === layerId);
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

  updateLayerStyle(layerId: string, changes: Partial<LayerVisualStyle>) {
    const layer = this.selectedLayer();

    if (!layer || layer.id !== layerId) {
      return false;
    }

    return this.hubStore.updateLayer(layerId, {
      style: {
        ...(layer.style ?? {}),
        ...changes,
      },
    } as Partial<EditorLayer>);
  }

  updatePartStyle(layerId: string, partKey: string, changes: Partial<ComponentPartStyle>) {
    const layer = this.selectedLayer();

    if (!layer || layer.id !== layerId ||
      (layer.type !== LayerType.LolScorebug && layer.type !== LayerType.LolPlayerRoster)) {
      return false;
    }

    return this.hubStore.updateLayer(layerId, {
      partStyles: {
        ...layer.partStyles,
        [partKey]: { ...layer.partStyles?.[partKey], ...changes },
      },
    } as Partial<EditorLayer>);
  }

  resetPartStyle(layerId: string, partKey: string) {
    const layer = this.selectedLayer();

    if (!layer || layer.id !== layerId ||
      (layer.type !== LayerType.LolScorebug && layer.type !== LayerType.LolPlayerRoster)) {
      return false;
    }

    const partStyles = { ...layer.partStyles };
    delete partStyles[partKey];
    return this.hubStore.updateLayer(layerId, { partStyles } as Partial<EditorLayer>);
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

  moveLayerForward(layerId: string) {
    return this.hubStore.reorderLayer(layerId, -1);
  }

  moveLayerBackward(layerId: string) {
    return this.hubStore.reorderLayer(layerId, 1);
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
    case LayerType.TeamGold:
    case LayerType.PlayerCreepScore:
    case LayerType.PlayerGold:
    case LayerType.PlayerItems:
    case LayerType.PlayerName:
    case LayerType.PlayerLevel:
    case LayerType.ChampionName:
    case LayerType.ChampionPortrait:
      return "0";
    default:
      return "New " + getLayerTypeLabel(type);
  }
}

function getLayerTypeLabel(type: LayerType) {
  switch (type) {
    case LayerType.Shape:
      return "Shape";
    case LayerType.VoidGrubs:
      return "Void Grubs";
    case LayerType.RiftHerald:
      return "Rift Herald";
    case LayerType.PlayerScore:
      return "Player Score";
    case LayerType.PlayerCreepScore:
      return "Player CS";
    case LayerType.PlayerGold:
      return "Player Gold";
    case LayerType.PlayerItems:
      return "Player Items";
    case LayerType.PlayerName:
      return "Player Name";
    case LayerType.PlayerLevel:
      return "Player Level";
    case LayerType.ChampionName:
      return "Champion Name";
    case LayerType.ChampionPortrait:
      return "Champion Portrait";
    case LayerType.TeamGold:
      return "Team Gold";
    case LayerType.GoldDiff:
      return "Gold Diff";
    case LayerType.LolScorebug:
      return "LoL Scorebug";
    case LayerType.LolPlayerRoster:
      return "LoL Player Roster";
    case LayerType.Time:
      return "Time";
    default:
      return type;
  }
}
