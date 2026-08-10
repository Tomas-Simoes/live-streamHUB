import { Injectable, computed, signal } from '@angular/core';
import { map, tap } from 'rxjs';

import { Hub, HubResponse } from '../../../shared/types/hub.types';
import { EditorLayer } from '../../../shared/types/layer.types';
import { HubsApi } from 'src/app/core/api/hub.api';

@Injectable({ providedIn: 'root' })
export class HubStore {
  hubs = signal<Hub[]>([]);
  selectedHubId = signal<string | null>(null);
  selectedHub = computed(() => {
    const selectedHubId = this.selectedHubId();

    return this.hubs().find((hub) => hub._id === selectedHubId) ?? null;
  });

  constructor(private hubsApi: HubsApi) { }

  loadMyHubs() {
    this.hubsApi.getMyHubs().subscribe({
      next: (hubs) => {
        const normalizedHubs = hubs.map((hub) => this.toHub(hub));
        const selectedHubId = this.selectedHubId();
        const selectedHubExists = normalizedHubs.some((hub) => hub._id === selectedHubId);

        this.hubs.set(normalizedHubs);
        this.selectedHubId.set(
          selectedHubExists
            ? selectedHubId
            : normalizedHubs[0]?._id ?? null
        );
      },
      error: () => {
        this.hubs.set([]);
        this.selectedHubId.set(null);
      },
    });
  }

  createHub() {
    return this.hubsApi.createHub({
      hubName: 'New Hub',
      layout: {
        layers: [],
      },
    }).pipe(
      map((hub) => this.toHub(hub)),
      tap((createdHub) => {
        this.hubs.update((hubs) => [createdHub, ...hubs]);
        this.selectedHubId.set(createdHub._id);
      })
    );
  }

  selectHub(hubId: string) {
    this.selectedHubId.set(hubId);
  }

  addLayer(layer: EditorLayer) {
    return this.updateSelectedHubLayers((layers) => [layer, ...layers]);
  }

  updateLayer(
    layerId: string,
    changes: Partial<EditorLayer>
  ) {
    return this.updateSelectedHubLayers((layers) =>
      layers.map(layer =>
        layer.id === layerId
          ? {
            ...layer,
            ...changes
          } as EditorLayer
          : layer
      )
    );
  }

  private toHub(hub: HubResponse): Hub {
    return {
      ...hub,
      layers: Array.isArray(hub.layout?.['layers'])
        ? hub.layout['layers'] as EditorLayer[]
        : [],
    };
  }

  private updateSelectedHubLayers(updateLayers: (layers: EditorLayer[]) => EditorLayer[]) {
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
          : hub
      )
    );

    return true;
  }
}
