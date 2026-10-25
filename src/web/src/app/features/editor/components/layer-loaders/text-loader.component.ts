import { Component, Input } from '@angular/core';

import { TextLayer } from '../../../../shared/types/layer.types';

@Component({
  selector: 'app-text-loader',
  standalone: false,
  template: `
    <span
      class="text-layer"
      data-component-part="text"
      [style.color]="layer.color"
      [style.font-size]="getCanvasFontSize()"
      [style.font-family]="layer.fontFamily"
      [style.font-weight]="layer.fontWeight || (layer.bold ? 700 : 400)"
      [style.letter-spacing.px]="layer.letterSpacing ?? 0"
      [style.text-align]="layer.textAlign || 'center'"
      [style.line-height]="layer.lineHeight || 1.15"
      [style.text-transform]="layer.uppercase ? 'uppercase' : 'none'"
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
        line-height: 1.15;
        text-overflow: ellipsis;
        white-space: nowrap;
        width: 100%;
      }
    `,
  ],
})
export class TextLoaderComponent {
  @Input({ required: true }) layer!: TextLayer;

  getCanvasFontSize() {
    return `${Math.max(1, this.layer.fontSize) / 19.2}cqw`;
  }
}
