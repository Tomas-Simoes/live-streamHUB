import { Injectable, computed, signal } from '@angular/core';

import { Hub } from '../../../shared/types/hub.types';
import { LayerType } from '../../../shared/types/layer.types';
import { User } from '../../../shared/types/user.types';

const demoUser: User = {
  id: 1,
  name: 'Live Stream HUB',
  email: 'studio@livestreamhub.local',
};

function createDemoHubs(): Hub[] {
  return [
    {
      user: demoUser,
      layers: [
        {
          id: 'score-topbar',
          name: 'Score Topbar',
          type: LayerType.Group,
          visible: true,
          position: { x: 960, y: 86 },
          width: 1180,
          height: 96,
        },
        {
          id: 'team-kills',
          name: 'Team Kills',
          type: LayerType.Kills,
          visible: true,
          position: { x: 580, y: 86 },
          width: 160,
          height: 58,
        },
        {
          id: 'tower-count',
          name: 'Tower Count',
          type: LayerType.Towers,
          visible: true,
          position: { x: 1340, y: 86 },
          width: 160,
          height: 58,
        },
      ],
    },
    {
      user: demoUser,
      layers: [
        {
          id: 'caster-lower-third',
          name: 'Caster Lower Third',
          type: LayerType.Text,
          visible: true,
          position: { x: 960, y: 906 },
          width: 760,
          height: 86,
        },
        {
          id: 'sponsor-image',
          name: 'Sponsor Image',
          type: LayerType.Image,
          visible: true,
          position: { x: 1560, y: 920 },
          width: 280,
          height: 94,
        },
      ],
    },
    {
      user: demoUser,
      layers: [
        {
          id: 'break-video',
          name: 'Break Video',
          type: LayerType.Video,
          visible: true,
          position: { x: 960, y: 540 },
          width: 1160,
          height: 650,
        },
        {
          id: 'break-title',
          name: 'Break Title',
          type: LayerType.Text,
          visible: true,
          position: { x: 960, y: 164 },
          width: 640,
          height: 80,
        },
        {
          id: 'break-group',
          name: 'Break Group',
          type: LayerType.Group,
          visible: true,
          position: { x: 960, y: 910 },
          width: 980,
          height: 118,
        },
      ],
    },
    {
      user: demoUser,
      layers: [
        {
          id: 'compact-kills',
          name: 'Compact Kills',
          type: LayerType.Kills,
          visible: true,
          position: { x: 1550, y: 132 },
          width: 188,
          height: 72,
        },
        {
          id: 'compact-towers',
          name: 'Compact Towers',
          type: LayerType.Towers,
          visible: true,
          position: { x: 1550, y: 230 },
          width: 188,
          height: 72,
        },
        {
          id: 'compact-logo',
          name: 'Compact Logo',
          type: LayerType.Image,
          visible: true,
          position: { x: 1742, y: 74 },
          width: 118,
          height: 74,
        },
      ],
    },
  ];
}

@Injectable()
export class HubStore {
  hubs = signal<Hub[]>(createDemoHubs());
  selectedHubIndex = signal(0);
  selectedHub = computed(() => this.hubs()[this.selectedHubIndex()] ?? null);

  selectHub(index: number) {
    if (index < 0 || index >= this.hubs().length) {
      return;
    }

    this.selectedHubIndex.set(index);
  }

  nextHub() {
    const hubs = this.hubs();

    if (!hubs.length) {
      return;
    }

    this.selectedHubIndex.update((index) => (index + 1) % hubs.length);
  }

  previousHub() {
    const hubs = this.hubs();

    if (!hubs.length) {
      return;
    }

    this.selectedHubIndex.update((index) => (index - 1 + hubs.length) % hubs.length);
  }

  setHubs(hubs: Hub[]) {
    this.hubs.set(hubs);
    this.selectedHubIndex.set(hubs.length ? 0 : -1);
  }
}
