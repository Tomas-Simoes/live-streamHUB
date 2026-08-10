import { Injectable, computed, signal } from '@angular/core';

import { Hub } from '../../../shared/types/hub.types';
import { HubStore } from '../state/hub.store';

type HubCard = {
  name: string;
  category: string;
  description: string;
  features: string[];
  status: string;
};

type HubEntry = {
  hub: Hub;
  index: number;
  card: HubCard;
};

@Injectable()
export class HubLibraryPresenter {
  private readonly liveHubId = signal<string | null>(null);
  private readonly hubCards: HubCard[] = [];

  readonly entries = computed<HubEntry[]>(() =>
    this.hubStore.hubs().map((hub, index) => ({
      hub,
      index,
      card: this.getHubCard(index),
    }))
  );

  readonly selectedEntry = computed(() => {
    const selectedHubId = this.hubStore.selectedHubId();

    return this.entries().find((entry) => entry.hub._id === selectedHubId) ?? null;
  });

  readonly selectedCard = computed(() => this.selectedEntry()?.card ?? this.getHubCard(0));

  readonly selectedStatus = computed(() => {
    const selectedHubId = this.hubStore.selectedHubId();

    return selectedHubId && selectedHubId === this.liveHubId()
      ? 'Active'
      : this.selectedCard().status;
  });

  readonly selectedPosition = computed(() => {
    const selectedHubId = this.hubStore.selectedHubId();

    return this.entries().findIndex((entry) => entry.hub._id === selectedHubId) + 1;
  });

  readonly selectedTotal = computed(() => this.entries().length);

  constructor(private hubStore: HubStore) { }

  selectNextHub() {
    this.selectHubByOffset(1);
  }

  selectPreviousHub() {
    this.selectHubByOffset(-1);
  }

  activateSelectedHub() {
    const selectedHubId = this.hubStore.selectedHubId();

    if (selectedHubId) {
      this.activateHub(selectedHubId);
    }
  }

  activateHub(hubId: string) {
    this.liveHubId.set(hubId);
  }

  getLayerCount(hub: Hub) {
    return hub.layers.length;
  }

  getVisibleLayerCount(hub: Hub) {
    return hub.layers.filter((layer) => layer.visible).length;
  }

  private selectHubByOffset(offset: 1 | -1) {
    const entries = this.entries();

    if (!entries.length) {
      return;
    }

    const selectedHubId = this.hubStore.selectedHubId();
    const currentPosition = entries.findIndex((entry) => entry.hub._id === selectedHubId);
    const fallbackPosition = offset === 1 ? 0 : entries.length - 1;
    const nextPosition = currentPosition === -1
      ? fallbackPosition
      : (currentPosition + offset + entries.length) % entries.length;

    this.hubStore.selectHub(entries[nextPosition].hub._id);
  }

  private getHubCard(index: number): HubCard {
    return this.hubCards[index] ?? {
      name: `Hub ${index + 1}`,
      category: 'Custom',
      description: 'Custom hub layout.',
      features: ['Custom'],
      status: 'Draft',
    };
  }
}
