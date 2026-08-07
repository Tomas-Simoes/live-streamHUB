import { Component, Input } from '@angular/core';

import { TextLayer } from '../../../../shared/types/layer.types';

@Component({
  selector: 'app-text-loader',
  standalone: false,
  template: `
    <span
      class="text-layer"
      [style.color]="layer.color"
      [style.--text-font-size]="layer.fontSize"
      [style.font-family]="layer.fontFamily"
    >
      {{ layer.text }}
    </span>
  `,
  styles: [
    `
      :host {
        display: grid;
        width: 100%;
        height: 100%;
        place-items: center;
        overflow: hidden;
      }

      .text-layer {
        overflow: hidden;
        max-width: 100%;
        max-height: 100%;
        font-size: max(8px, calc(var(--text-font-size) * 100cqw / 1920));
        line-height: 1.15;
        text-align: center;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ],
})
export class TextLoaderComponent {
  @Input({ required: true }) layer!: TextLayer;
}
