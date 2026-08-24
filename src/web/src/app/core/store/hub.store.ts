import { Injectable, computed, signal } from "@angular/core";
import { finalize, map, tap } from "rxjs";

import { Hub, HubResponse } from "../../shared/types/hub.types";
import { EditorLayer, LayerType } from "../../shared/types/layer.types";
import { HubsApi } from "src/app/core/api/hub.api";
import {
  DEFAULT_HUB_BACKGROUND_ID,
  getHubBackground,
} from "../../shared/types/hub-background.types";

@Injectable({ providedIn: "root" })
export class HubStore {
  hubs = signal<Hub[]>([]);
  selectedHubId = signal<string | null>(null);
  private dirtyHubIds = signal<ReadonlySet<string>>(new Set());
  private hubEditVersions = new Map<string, number>();

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

  constructor(private hubsApi: HubsApi) {}

  loadMyHubs() {
    this.hubsApi.getMyHubs().subscribe({
      next: (hubs) => {
        const normalizedHubs = hubs.map((hub) => this.toHub(hub));
        const selectedHubId = this.selectedHubId();

        this.hubs.set(normalizedHubs);
        this.dirtyHubIds.set(new Set());
        this.selectedHubId.set(
          normalizedHubs.some((hub) => hub._id === selectedHubId)
            ? selectedHubId
            : (normalizedHubs[0]?._id ?? null),
        );
      },
      error: () => {
        this.hubs.set([]);
        this.selectedHubId.set(null);
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

  selectHub(hubId: string) {
    this.selectedHubId.set(hubId);
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
              ...changes,
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

          if (hasLocalEditsAfterSave) {
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

    if (normalizedLayer.type === LayerType.Text) {
      return {
        ...normalizedLayer,
        bold: normalizedLayer.bold === true,
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

    this.hubs.update((hubs) =>
      hubs.map((hub) =>
        hub._id === selectedHub._id ? updateHub(hub) : hub,
      ),
    );

    this.markHubDirty(selectedHub._id);

    return true;
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
    this.dirtyHubIds.update((dirtyHubIds) => {
      const nextDirtyHubIds = new Set(dirtyHubIds);

      nextDirtyHubIds.add(hubId);

      return nextDirtyHubIds;
    });
  }

  private markHubClean(hubId: string) {
    this.dirtyHubIds.update((dirtyHubIds) => {
      const nextDirtyHubIds = new Set(dirtyHubIds);

      nextDirtyHubIds.delete(hubId);

      return nextDirtyHubIds;
    });
  }
}

function isTeamBoundLayer(layer: EditorLayer) {
  return (
    layer.type === LayerType.Kills ||
    layer.type === LayerType.Towers ||
    layer.type === LayerType.VoidGrubs ||
    layer.type === LayerType.RiftHerald ||
    layer.type === LayerType.Dragon ||
    layer.type === LayerType.PlayerScore
  );
}
