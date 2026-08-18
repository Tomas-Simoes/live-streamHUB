import { Injectable, computed, signal } from "@angular/core";

import { Hub } from "../../../shared/types/hub.types";
import { HubStore } from "../../../core/hub.store";

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
      card: this.getHubCard(hub, index),
    })),
  );

  readonly selectedEntry = computed(() => {
    const selectedHubId = this.hubStore.selectedHubId();

    return (
      this.entries().find((entry) => entry.hub._id === selectedHubId) ?? null
    );
  });

  readonly selectedIndex = computed(() => {
    const selectedHubId = this.hubStore.selectedHubId();

    return this.entries().findIndex((entry) => entry.hub._id === selectedHubId);
  });

  readonly selectedCard = computed(
    () => this.selectedEntry()?.card ?? this.getHubCard(null, 0),
  );

  readonly selectedStatus = computed(() => {
    const selectedHubId = this.hubStore.selectedHubId();

    return selectedHubId && selectedHubId === this.liveHubId()
      ? "Active"
      : this.selectedCard().status;
  });

  readonly selectedPosition = computed(() => {
    const selectedHubId = this.hubStore.selectedHubId();

    return (
      this.entries().findIndex((entry) => entry.hub._id === selectedHubId) + 1
    );
  });

  readonly selectedTotal = computed(() => this.entries().length);

  readonly previousEntry = computed(() => this.getEntryByOffset(-1));

  readonly nextEntry = computed(() => this.getEntryByOffset(1));

  constructor(private hubStore: HubStore) {}

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
    const entry = this.getEntryByOffset(offset);

    if (entry) {
      this.hubStore.selectHub(entry.hub._id);
    }
  }

  private getEntryByOffset(offset: 1 | -1): HubEntry | null {
    const entries = this.entries();

    if (entries.length < 2) {
      return null;
    }

    const currentPosition = this.selectedIndex();
    const fallbackPosition = offset === 1 ? 0 : entries.length - 1;
    const nextPosition =
      currentPosition === -1
        ? fallbackPosition
        : (currentPosition + offset + entries.length) % entries.length;

    return entries[nextPosition];
  }

  private getHubCard(hub: Hub | null, index: number): HubCard {
    const storedCard = this.hubCards[index];
    const name = hub?.hubName?.trim() || storedCard?.name || `Hub ${index + 1}`;
    const layerCount = hub?.layers.length ?? 0;

    return {
      name,
      category: storedCard?.category ?? "Custom stream hub",
      description:
        storedCard?.description ??
        "A reusable overlay scene for match coverage, stream moments, and live broadcast updates.",
      features:
        storedCard?.features ??
        (layerCount ? ["Layered canvas", "OBS ready", "Live controls"] : ["Blank canvas"]),
      status: storedCard?.status ?? "Draft",
    };
  }
}
