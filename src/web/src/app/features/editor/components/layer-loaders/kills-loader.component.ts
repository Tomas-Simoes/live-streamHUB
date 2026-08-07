import { Component, Input } from '@angular/core';

import { KillsLayer } from '../../../../shared/types/layer.types';

@Component({
  selector: 'app-kills-loader',
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
export class KillsLoaderComponent {
  @Input({ required: true }) layer!: KillsLayer;
}
