import { Injectable, computed, signal } from "@angular/core";
import { finalize, map, tap } from "rxjs";

import { Hub, HubResponse } from "../shared/types/hub.types";
import { EditorLayer } from "../shared/types/layer.types";
import { HubsApi } from "src/app/core/api/hub.api";

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
    () => !!this.selectedHub() && this.hasUnsavedChanges() && !this.isSaving(),
  );

  constructor(private hubsApi: HubsApi) {}

  loadMyHubs() {
    this.hubsApi.getMyHubs().subscribe({
      next: (hubs) => {
        const normalizedHubs = hubs.map((hub) => this.toHub(hub));
        const selectedHubId = this.selectedHubId();
        const selectedHubExists = normalizedHubs.some(
          (hub) => hub._id === selectedHubId,
        );

        this.hubs.set(normalizedHubs);
        this.dirtyHubIds.set(new Set());
        this.selectedHubId.set(
          selectedHubExists ? selectedHubId : (normalizedHubs[0]?._id ?? null),
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
    return this.updateSelectedHubLayers((layers) => [layer, ...layers]);
  }

  updateLayer(layerId: string, changes: Partial<EditorLayer>) {
    return this.updateSelectedHubLayers((layers) =>
      layers.map((layer) =>
        layer.id === layerId
          ? ({
              ...layer,
              ...changes,
            } as EditorLayer)
          : layer,
      ),
    );
  }

  saveSelectedHub() {
    const hub = this.selectedHub();

    if (!hub || this.isSaving()) {
      return;
    }

    const saveVersion = this.getHubEditVersion(hub._id);

    this.isSaving.set(true);
    this.saveError.set(null);

    this.hubsApi
      .updateHub(hub._id, {
        hubName: hub.hubName,
        layout: this.toPersistedLayout(hub),
      })
      .pipe(
        map((savedHub) => this.toHub(savedHub)),
        finalize(() => this.isSaving.set(false)),
      )
      .subscribe({
        next: (savedHub) => {
          const hasLocalEditsAfterSave =
            this.getHubEditVersion(savedHub._id) !== saveVersion;

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
    return {
      ...hub,
      layers: Array.isArray(hub.layout?.["layers"])
        ? (hub.layout["layers"] as EditorLayer[])
        : [],
    };
  }

  private updateSelectedHubLayers(
    updateLayers: (layers: EditorLayer[]) => EditorLayer[],
  ) {
    const selectedHub = this.selectedHub();

    if (!selectedHub) {
      return false;
    }

    const layers = updateLayers(selectedHub.layers);

    this.hubs.update((hubs) =>
      hubs.map((hub) =>
        hub._id === selectedHub._id
          ? {
              ...hub,
              layers,
              layout: {
                ...hub.layout,
                layers,
              },
            }
          : hub,
      ),
    );

    this.markHubDirty(selectedHub._id);

    return true;
  }

  private toPersistedLayout(hub: Hub): Record<string, any> {
    return {
      ...(hub.layout ?? {}),
      layers: hub.layers,
    };
  }

  private getHubEditVersion(hubId: string): number {
    return this.hubEditVersions.get(hubId) ?? 0;
  }

  private markHubDirty(hubId: string) {
    this.hubEditVersions.set(hubId, this.getHubEditVersion(hubId) + 1);
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
