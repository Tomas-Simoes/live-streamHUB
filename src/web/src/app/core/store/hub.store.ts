import { Injectable, computed, signal } from "@angular/core";
import { reconcileManualCss } from '../../shared/helpers/authored-css';
import { finalize, map, tap } from "rxjs";

import { Hub, HubLayout, HubResponse } from "../../shared/types/hub.types";
import { EditorLayer, LayerType } from "../../shared/types/layer.types";
import { HubsApi } from "src/app/core/api/hub.api";
import {
  DEFAULT_HUB_BACKGROUND_ID,
  getHubBackground,
} from "../../shared/types/hub-background.types";
import { getPredefinedHubTemplate } from "../../shared/templates/predefined-hub-templates";

type HubHistory = {
  past: Hub[];
  future: Hub[];
};

const HUB_HISTORY_LIMIT = 100;

@Injectable({ providedIn: "root" })
export class HubStore {
  hubs = signal<Hub[]>([]);
  selectedHubId = signal<string | null>(null);
  private dirtyHubIds = signal<ReadonlySet<string>>(new Set());
  private hubEditVersions = new Map<string, number>();
  private savedHubContents = new Map<string, string>();
  private hubHistories = signal<ReadonlyMap<string, HubHistory>>(new Map());
  private historyGroupHubId: string | null = null;
  private hasGroupedEdit = false;

  selectedHub = computed(() => {
    const selectedHubId = this.selectedHubId();

    return this.hubs().find((hub) => hub._id === selectedHubId) ?? null;
  });
  isSaving = signal(false);
  saveError = signal<string | null>(null);
  hasUnsavedChanges = computed(() => {
    const selectedHubId = this.selectedHubId();

    return !!selectedHubId && this.dirtyHubIds().has(selectedHubId);
  });
  canSave = computed(
    () =>
      !!this.selectedHub() &&
      this.hasUnsavedChanges() &&
      !this.hasUnpersistedMedia() &&
      !this.isSaving(),
  );
  canUndo = computed(
    () => !!this.hubHistories().get(this.selectedHubId() ?? "")?.past.length,
  );
  canRedo = computed(
    () => !!this.hubHistories().get(this.selectedHubId() ?? "")?.future.length,
  );

  constructor(private hubsApi: HubsApi) {}

  loadMyHubs() {
    this.hubsApi.getMyHubs().subscribe({
      next: (hubs) => {
        const normalizedHubs = hubs.map((hub) => this.toHub(hub));
        const selectedHubId = this.selectedHubId();

        this.hubs.set(normalizedHubs);
        this.dirtyHubIds.set(new Set());
        this.hubHistories.set(new Map());
        this.savedHubContents = new Map(
          normalizedHubs.map((hub) => [hub._id, getHubContentKey(hub)]),
        );
        this.endHistoryGroup();
        this.selectedHubId.set(
          normalizedHubs.some((hub) => hub._id === selectedHubId)
            ? selectedHubId
            : (normalizedHubs[0]?._id ?? null),
        );
      },
      error: () => {
        this.hubs.set([]);
        this.selectedHubId.set(null);
        this.hubHistories.set(new Map());
        this.savedHubContents.clear();
        this.endHistoryGroup();
      },
    });
  }

  createHub() {
    return this.hubsApi
      .createHub({
        hubName: "New Hub",
        layout: {
          backgroundId: DEFAULT_HUB_BACKGROUND_ID,
          layers: [],
        },
      })
      .pipe(
        map((hub) => this.toHub(hub)),
        tap((createdHub) => {
          this.hubs.update((hubs) => [createdHub, ...hubs]);
          this.markHubClean(createdHub._id);
          this.selectedHubId.set(createdHub._id);
        }),
      );
  }

  createLeagueBroadcastHub() {
    return this.createHubFromTemplate("cblol-broadcast");
  }

  createHubFromTemplate(templateId: string) {
    const template = getPredefinedHubTemplate(templateId);

    if (!template) {
      return this.createHub();
    }

    return this.hubsApi
      .createHub({
        hubName: template.name,
        layout: template.createLayout(),
      })
      .pipe(
        map((hub) => this.toHub(hub)),
        tap((createdHub) => {
          this.hubs.update((hubs) => [createdHub, ...hubs]);
          this.markHubClean(createdHub._id);
          this.selectedHubId.set(createdHub._id);
        }),
      );
  }

  selectHub(hubId: string) {
    this.endHistoryGroup();
    this.selectedHubId.set(hubId);
  }

  beginHistoryGroup() {
    this.historyGroupHubId = this.selectedHubId();
    this.hasGroupedEdit = false;
  }

  endHistoryGroup() {
    this.historyGroupHubId = null;
    this.hasGroupedEdit = false;
  }

  undoSelectedHub() {
    return this.restoreHubHistory("past");
  }

  redoSelectedHub() {
    return this.restoreHubHistory("future");
  }

  deleteHub(hubId: string) {
    return this.hubsApi.deleteHub(hubId).pipe(
      tap(() => {
        const deletedIndex = this.hubs().findIndex((hub) => hub._id === hubId);

        this.hubs.update((hubs) => hubs.filter((hub) => hub._id !== hubId));
        this.markHubClean(hubId);
        this.hubEditVersions.delete(hubId);
        this.hubHistories.update((histories) => {
          const nextHistories = new Map(histories);

          nextHistories.delete(hubId);

          return nextHistories;
        });

        if (this.selectedHubId() === hubId) {
          this.endHistoryGroup();
          const hubs = this.hubs();
          this.selectedHubId.set(
            hubs[Math.max(0, Math.min(deletedIndex, hubs.length - 1))]?._id ?? null,
          );
        }
      }),
    );
  }

  addLayer(layer: EditorLayer) {
    return this.updateSelectedHub((hub) => {
      const layers = [layer, ...hub.layers];

      return {
        ...hub,
        layers,
        layout: {
          ...hub.layout,
          layers,
        },
      };
    });
  }

  /** Apply a reviewed AI proposal as one normal undoable, unsaved editor change. */
  applyAiLayout(hubId: string, layout: HubLayout, expectedContent: string) {
    const current = this.selectedHub();
    if (!current || current._id !== hubId || JSON.stringify([current._id, current.layout, current.layers]) !== expectedContent) return false;
    this.endHistoryGroup();
    const next = structuredClone(layout);
    return this.updateSelectedHub(hub => ({ ...hub, layout: next, layers: next.layers ?? [] }));
  }

  removeLayer(layerId: string) {
    return this.updateSelectedHub((hub) => {
      const removedLayer = hub.layers.find((layer) => layer.id === layerId);
      const layers = hub.layers
        .filter((layer) => layer.id !== layerId)
        .map((layer) =>
          removedLayer?.type === LayerType.Group && layer.groupId === layerId
            ? ({
                ...layer,
                groupId: null,
              } as EditorLayer)
            : layer,
        );

      return {
        ...hub,
        layers,
        layout: {
          ...hub.layout,
          layers,
        },
      };
    });
  }

  updateLayer(layerId: string, changes: Partial<EditorLayer>) {
    return this.updateSelectedHub((hub) => {
      const layers = hub.layers.map((layer) =>
        layer.id === layerId
          ? ({
              ...layer,
              ...reconcileManualCss(layer, changes),
            } as EditorLayer)
          : layer,
      );

      return {
        ...hub,
        layers,
        layout: {
          ...hub.layout,
          layers,
        },
      };
    });
  }

  reorderLayer(layerId: string, offset: -1 | 1) {
    return this.updateSelectedHub((hub) => {
      const currentIndex = hub.layers.findIndex((layer) => layer.id === layerId);

      if (currentIndex === -1) {
        return hub;
      }

      const nextIndex = Math.min(
        Math.max(currentIndex + offset, 0),
        hub.layers.length - 1,
      );

      if (nextIndex === currentIndex) {
        return hub;
      }

      const layers = [...hub.layers];
      const [layer] = layers.splice(currentIndex, 1);

      layers.splice(nextIndex, 0, layer);

      return {
        ...hub,
        layers,
        layout: {
          ...hub.layout,
          layers,
        },
      };
    });
  }

  updateSelectedHubBackground(backgroundId: string) {
    const background = getHubBackground(backgroundId);

    return this.updateSelectedHub((hub) => ({
      ...hub,
      layout: {
        ...(hub.layout ?? {}),
        backgroundId: background.id,
      },
    }));
  }

  saveSelectedHub() {
    const hub = this.selectedHub();

    if (!hub || this.isSaving()) {
      return;
    }

    const saveVersion = this.hubEditVersions.get(hub._id) ?? 0;

    this.isSaving.set(true);
    this.saveError.set(null);

    this.hubsApi
      .updateHub(hub._id, {
        hubName: hub.hubName,
        layout: {
          ...(hub.layout ?? {}),
          backgroundId: getHubBackground(hub.layout?.["backgroundId"]).id,
          layers: hub.layers,
        },
      })
      .pipe(
        map((savedHub) => this.toHub(savedHub)),
        finalize(() => this.isSaving.set(false)),
      )
      .subscribe({
        next: (savedHub) => {
          const hasLocalEditsAfterSave =
            (this.hubEditVersions.get(savedHub._id) ?? 0) !== saveVersion;

          this.savedHubContents.set(savedHub._id, getHubContentKey(savedHub));

          if (hasLocalEditsAfterSave) {
            this.refreshHubDirtyState(savedHub._id);
            return;
          }

          this.hubs.update((hubs) =>
            hubs.map((hub) => (hub._id === savedHub._id ? savedHub : hub)),
          );
          this.markHubClean(savedHub._id);
        },
        error: () => {
          this.saveError.set("Save failed");
        },
      });
  }

  private toHub(hub: HubResponse): Hub {
    const layout = {
      ...(hub.layout ?? {}),
      backgroundId: getHubBackground(hub.layout?.["backgroundId"]).id,
    };

    return {
      ...hub,
      layout,
      layers: Array.isArray(layout["layers"])
        ? (layout["layers"] as EditorLayer[]).map((layer) =>
            this.normalizeLayer(layer),
          )
        : [],
    };
  }

  private normalizeLayer(layer: EditorLayer): EditorLayer {
    const normalizedLayer = {
      ...layer,
      visible: layer.visible !== false,
      groupId:
        typeof layer.groupId === "string" && layer.groupId.trim()
          ? layer.groupId
          : null,
    } as EditorLayer;

    if (normalizedLayer.type === LayerType.Group) {
      return {
        ...normalizedLayer,
        collapsed: normalizedLayer.collapsed === true,
        groupId: null,
      } as EditorLayer;
    }

    if (normalizedLayer.type === LayerType.PlayerScore) {
      return {
        ...normalizedLayer,
        team: normalizedLayer.team || "blue",
        role: normalizedLayer.role || "top",
      } as EditorLayer;
    }

    if (isPlayerBoundLayer(normalizedLayer)) {
      return {
        ...normalizedLayer,
        team: normalizedLayer.team || "blue",
        role: normalizedLayer.role || "top",
      } as EditorLayer;
    }

    if (normalizedLayer.type === LayerType.PlayerItems) {
      return {
        ...normalizedLayer,
        team: normalizedLayer.team || "blue",
        role: normalizedLayer.role || "top",
        showTrinket: normalizedLayer.showTrinket !== false,
      } as EditorLayer;
    }

    if (normalizedLayer.type === LayerType.ChampionPortrait) {
      return {
        ...normalizedLayer,
        team: normalizedLayer.team || "blue",
        role: normalizedLayer.role || "top",
        shape: normalizedLayer.shape || "square",
        showLevel: normalizedLayer.showLevel !== false,
      } as EditorLayer;
    }

    if (normalizedLayer.type === LayerType.LolScorebug) {
      return {
        ...normalizedLayer,
        blueTeamCode: normalizedLayer.blueTeamCode || "BLUE",
        redTeamCode: normalizedLayer.redTeamCode || "RED",
        blueAccent: normalizedLayer.blueAccent || "#34d5e6",
        redAccent: normalizedLayer.redAccent || "#ef7d24",
        showGold: normalizedLayer.showGold !== false,
        showObjectives: normalizedLayer.showObjectives !== false,
        showGameTime: normalizedLayer.showGameTime !== false,
      } as EditorLayer;
    }

    if (normalizedLayer.type === LayerType.LolPlayerRoster) {
      return {
        ...normalizedLayer,
        team: normalizedLayer.team || "blue",
        orientation: normalizedLayer.orientation || "left",
        showChampion: normalizedLayer.showChampion !== false,
        showLevel: normalizedLayer.showLevel !== false,
        showKda: normalizedLayer.showKda !== false,
        showCs: normalizedLayer.showCs !== false,
        showGold: normalizedLayer.showGold === true,
        showItems: normalizedLayer.showItems !== false,
      } as EditorLayer;
    }

    if (normalizedLayer.type === LayerType.Text) {
      return {
        ...normalizedLayer,
        bold: normalizedLayer.bold === true,
        fontWeight: normalizedLayer.fontWeight || (normalizedLayer.bold ? 700 : 400),
        letterSpacing: normalizedLayer.letterSpacing ?? 0,
        textAlign: normalizedLayer.textAlign || "center",
        lineHeight: normalizedLayer.lineHeight || 1.15,
        uppercase: normalizedLayer.uppercase === true,
      } as EditorLayer;
    }

    if (normalizedLayer.type === LayerType.Image) {
      return {
        ...normalizedLayer,
        opacity: Number.isFinite(Number(normalizedLayer.opacity))
          ? normalizedLayer.opacity
          : 100,
        fit: normalizedLayer.fit || "cover",
        objectPosition: normalizedLayer.objectPosition || "center",
      } as EditorLayer;
    }

    if (normalizedLayer.type === LayerType.Video) {
      return {
        ...normalizedLayer,
        fit: normalizedLayer.fit || "cover",
        objectPosition: normalizedLayer.objectPosition || "center",
      } as EditorLayer;
    }

    if (
      isTeamBoundLayer(normalizedLayer) &&
      !normalizedLayer.team
    ) {
      return {
        ...normalizedLayer,
        team: "blue",
      } as EditorLayer;
    }

    return normalizedLayer;
  }

  private updateSelectedHub(updateHub: (hub: Hub) => Hub) {
    const selectedHub = this.selectedHub();

    if (!selectedHub) {
      return false;
    }

    const updatedHub = updateHub(selectedHub);
    const previousContent = getHubContentKey(selectedHub);

    if (updatedHub === selectedHub || getHubContentKey(updatedHub) === previousContent) {
      return false;
    }

    if (!this.savedHubContents.has(selectedHub._id)) {
      this.savedHubContents.set(selectedHub._id, previousContent);
    }

    const isGroupedEdit = this.historyGroupHubId === selectedHub._id;

    if (!isGroupedEdit || !this.hasGroupedEdit) {
      const snapshot = this.getHistorySnapshot(selectedHub);

      this.hubHistories.update((histories) => {
        const history = histories.get(selectedHub._id) ?? { past: [], future: [] };
        const previousSnapshot = history.past.at(-1);

        return new Map(histories).set(selectedHub._id, {
          past:
            previousSnapshot && getHubContentKey(previousSnapshot) === getHubContentKey(snapshot)
              ? history.past
              : [...history.past, snapshot].slice(-HUB_HISTORY_LIMIT),
          future: [],
        });
      });
    }

    if (isGroupedEdit) {
      this.hasGroupedEdit = true;
    }

    this.hubs.update((hubs) =>
      hubs.map((hub) =>
        hub._id === selectedHub._id ? updatedHub : hub,
      ),
    );

    this.markHubDirty(selectedHub._id);

    return true;
  }

  private restoreHubHistory(direction: "past" | "future") {
    this.endHistoryGroup();

    const selectedHub = this.selectedHub();

    if (!selectedHub) {
      return false;
    }

    const history = this.hubHistories().get(selectedHub._id);
    const snapshot = history?.[direction].at(-1);

    if (!history || !snapshot) {
      return false;
    }

    const oppositeDirection = direction === "past" ? "future" : "past";
    const currentSnapshot = this.getHistorySnapshot(selectedHub);

    this.hubHistories.update((histories) =>
      new Map(histories).set(selectedHub._id, {
        ...history,
        [direction]: history[direction].slice(0, -1),
        [oppositeDirection]: [...history[oppositeDirection], currentSnapshot],
      }),
    );
    this.hubs.update((hubs) =>
      hubs.map((hub) =>
        hub._id === selectedHub._id
          ? {
              ...hub,
              hubName: snapshot.hubName,
              layers: snapshot.layers,
              layout: { ...snapshot.layout, layers: snapshot.layers },
            }
          : hub,
      ),
    );
    this.markHubDirty(selectedHub._id);

    return true;
  }

  private getHistorySnapshot(hub: Hub): Hub {
    const history = this.hubHistories().get(hub._id);
    let hasTemporaryMedia = false;
    const layers = hub.layers.map((layer) => {
      if (
        (layer.type !== LayerType.Image && layer.type !== LayerType.Video) ||
        (!layer.src.startsWith("blob:") && layer.mediaUploadStatus !== "uploading")
      ) {
        return layer;
      }

      hasTemporaryMedia = true;
      let previousLayer: typeof layer | undefined;

      for (let index = (history?.past.length ?? 0) - 1; index >= 0; index--) {
        const candidate: EditorLayer | undefined = history!.past[index].layers.find((previous) => previous.id === layer.id);

        if (
          candidate?.type === layer.type &&
          "src" in candidate &&
          !candidate.src.startsWith("blob:") &&
          candidate.mediaUploadStatus !== "uploading"
        ) {
          previousLayer = candidate;
          break;
        }
      }

      // Upload previews can be revoked; history keeps the last usable source.
      return {
        ...layer,
        src: previousLayer?.src ?? "",
        mediaKey: previousLayer?.mediaKey,
        mediaStorage: previousLayer?.mediaStorage,
        mediaUploadStatus: previousLayer?.mediaUploadStatus,
        localFilePath: previousLayer?.localFilePath,
      };
    });

    return hasTemporaryMedia
      ? { ...hub, layers, layout: { ...hub.layout, layers } }
      : hub;
  }

  private hasUnpersistedMedia() {
    const selectedHub = this.selectedHub();

    if (!selectedHub) {
      return false;
    }

    return selectedHub.layers.some(
      (layer) =>
        "src" in layer &&
        typeof layer.src === "string" &&
        (layer.src.startsWith("blob:") ||
          layer.mediaUploadStatus === "uploading"),
    );
  }

  private markHubDirty(hubId: string) {
    this.hubEditVersions.set(hubId, (this.hubEditVersions.get(hubId) ?? 0) + 1);
    this.saveError.set(null);
    this.refreshHubDirtyState(hubId);
  }

  private refreshHubDirtyState(hubId: string) {
    const hub = this.hubs().find((hub) => hub._id === hubId);
    const isDirty = !!hub && this.savedHubContents.get(hubId) !== getHubContentKey(hub);

    this.dirtyHubIds.update((dirtyHubIds) => {
      const nextDirtyHubIds = new Set(dirtyHubIds);

      if (isDirty) {
        nextDirtyHubIds.add(hubId);
      } else {
        nextDirtyHubIds.delete(hubId);
      }

      return nextDirtyHubIds;
    });
  }

  private markHubClean(hubId: string) {
    const hub = this.hubs().find((hub) => hub._id === hubId);

    if (hub) {
      this.savedHubContents.set(hubId, getHubContentKey(hub));
    } else {
      this.savedHubContents.delete(hubId);
    }

    this.dirtyHubIds.update((dirtyHubIds) => {
      const nextDirtyHubIds = new Set(dirtyHubIds);

      nextDirtyHubIds.delete(hubId);

      return nextDirtyHubIds;
    });
  }
}

function getHubContentKey(hub: Hub) {
  return JSON.stringify({
    hubName: hub.hubName,
    layout: { ...hub.layout, layers: hub.layers },
  });
}

function isTeamBoundLayer(layer: EditorLayer) {
  return (
    layer.type === LayerType.Kills ||
    layer.type === LayerType.Towers ||
    layer.type === LayerType.VoidGrubs ||
    layer.type === LayerType.RiftHerald ||
    layer.type === LayerType.Dragon ||
    layer.type === LayerType.TeamGold ||
    layer.type === LayerType.PlayerScore ||
    isPlayerBoundLayer(layer) ||
    layer.type === LayerType.LolPlayerRoster
  );
}

function isPlayerBoundLayer(layer: EditorLayer) {
  return (
    layer.type === LayerType.PlayerCreepScore ||
    layer.type === LayerType.PlayerGold ||
    layer.type === LayerType.PlayerName ||
    layer.type === LayerType.PlayerLevel ||
    layer.type === LayerType.ChampionName
  );
}
