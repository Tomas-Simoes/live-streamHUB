import { Component, Input } from '@angular/core';

import { TowersLayer } from '../../../../shared/types/layer.types';

@Component({
  selector: 'app-towers-loader',
  standalone: false,
  template: `<span class="stat-layer">{{ layer.name }}</span>`,
  styles: [
    `
      :host {
        display: grid;
        width: 100%;
        height: 100%;
        place-items: center;
        overflow: hidden;
      }
    `,
  ],
})
export class TowersLoaderComponent {
  @Input({ required: true }) layer!: TowersLayer;
}
