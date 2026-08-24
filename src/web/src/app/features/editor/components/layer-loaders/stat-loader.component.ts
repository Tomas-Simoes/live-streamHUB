import { Component, Input } from '@angular/core';

import { LayerType, StatLayer } from '../../../../shared/types/layer.types';

@Component({
  selector: 'app-stat-loader',
  standalone: false,
  template: `<span class="stat-layer">{{ getPreviewText() }}</span>`,
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
export class StatLoaderComponent {
  @Input({ required: true }) layer!: StatLayer;

  getPreviewText() {
    switch (this.layer.type) {
      case LayerType.PlayerScore:
        return '0/0/0';
      case LayerType.Time:
        return '00:00';
      default:
        return this.layer.name;
    }
  }
}
