import { Component, signal } from '@angular/core';

import { Hub } from '../../../shared/types/hub.types';
import { Layer } from '../../../shared/types/layer.types';
import { HubStore } from './hub.store';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

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

@Component({
  selector: 'app-hubs',
  standalone: false,
  templateUrl: './hubs.component.html',
  styleUrls: ['../styles/hubs.styles.css'],
  providers: [HubStore],
})
export class HubsComponent {
  hubCards: HubCard[] = [
    {
      name: 'Match Control',
      category: 'Live Game',
      description: 'Score, kills, towers, and match pacing in one broadcast overlay.',
      features: ['Score', 'Kills', 'Towers'],
      status: 'Active',
    },
    {
      name: 'Caster Desk',
      category: 'Talent',
      description: 'Lower thirds and sponsor placement for interviews and desk segments.',
      features: ['Lower Thirds', 'Sponsor', 'Camera'],
      status: 'Ready',
    },
    {
      name: 'Break Loop',
      category: 'Break',
      description: 'Video-forward layout for breaks, schedule cards, and sponsor rotation.',
      features: ['Video', 'Schedule', 'Sponsor'],
      status: 'Ready',
    },
    {
      name: 'Compact HUD',
      category: 'Minimal',
      description: 'Small-footprint widgets for clean gameplay-focused streams.',
      features: ['Kills', 'Towers', 'Logo'],
      status: 'Draft',
    },
  ];
  liveHubIndex = signal(0);

  constructor(public hubStore: HubStore) { }

  getHubCard(index: number): HubCard {
    return this.hubCards[index] ?? {
      name: `Hub ${index + 1}`,
      category: 'Custom',
      description: 'Custom hub layout.',
      features: ['Custom'],
      status: 'Draft',
    };
  }

  getFilteredHubEntries(): HubEntry[] {
    return this.hubStore.hubs()
      .map((hub, index) => ({ hub, index, card: this.getHubCard(index) }));
  }

  getHubStatus(index: number) {
    return index === this.liveHubIndex() ? 'Active' : this.getHubCard(index).status;
  }

  nextVisibleHub() {
    const entries = this.getFilteredHubEntries();

    if (!entries.length) {
      return;
    }

    const currentPosition = entries.findIndex((entry) => entry.index === this.hubStore.selectedHubIndex());
    const nextPosition = currentPosition === -1 ? 0 : (currentPosition + 1) % entries.length;
    this.hubStore.selectHub(entries[nextPosition].index);
  }

  previousVisibleHub() {
    const entries = this.getFilteredHubEntries();

    if (!entries.length) {
      return;
    }

    const currentPosition = entries.findIndex((entry) => entry.index === this.hubStore.selectedHubIndex());
    const previousPosition = currentPosition === -1
      ? entries.length - 1
      : (currentPosition - 1 + entries.length) % entries.length;
    this.hubStore.selectHub(entries[previousPosition].index);
  }

  activateSelectedHub() {
    const selectedIndex = this.hubStore.selectedHubIndex();

    if (selectedIndex >= 0) {
      this.liveHubIndex.set(selectedIndex);
    }
  }

  getSelectedHubPosition() {
    const selectedIndex = this.hubStore.selectedHubIndex();

    return this.getFilteredHubEntries().findIndex((entry) => entry.index === selectedIndex) + 1;
  }

  getSelectedHubTotal() {
    return this.getFilteredHubEntries().length;
  }

  getLayerStyleValue(value: number, axis: 'x' | 'y') {
    return (value / (axis === 'x' ? CANVAS_WIDTH : CANVAS_HEIGHT)) * 100;
  }

  getLayerCount(hub: Hub) {
    return hub.layers.length;
  }

  getVisibleLayerCount(hub: Hub) {
    return hub.layers.filter((layer) => layer.visible).length;
  }

  getLayerPreviewClass(layer: Layer) {
    return `preview-layer preview-layer-${layer.type.toLowerCase()}`;
  }
}
