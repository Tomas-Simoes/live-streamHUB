import { Component, Input } from '@angular/core';

import { ShapeLayer } from '../../../../shared/types/layer.types';

@Component({
  selector: 'app-shape-loader',
  standalone: false,
  template: `<span class="shape-layer" aria-hidden="true"></span>`,
  styles: [
    `
      :host,
      .shape-layer {
        display: block;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
    `,
  ],
})
export class ShapeLoaderComponent {
  @Input({ required: true }) layer!: ShapeLayer;
}
