import { Component, Input } from '@angular/core';

import { ImageLayer } from '../../../../shared/types/layer.types';

@Component({
  selector: 'app-image-loader',
  standalone: false,
  template: `
    @if(layer.src){
      <img
        class="image-layer"
        [src]="layer.src"
        [alt]="layer.alt || layer.name"
        [style.opacity]="layer.opacity / 100"
        [style.object-fit]="layer.fit || 'cover'"
        [style.object-position]="layer.objectPosition || 'center'"
      />
    } @else {
      <span class="media-placeholder">{{ layer.name }}</span>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }

      .image-layer {
        display: block;
        width: 100%;
        height: 100%;
      }

      .media-placeholder {
        display: grid;
        width: 100%;
        height: 100%;
        place-items: center;
      }
    `,
  ],
})
export class ImageLoaderComponent {
  @Input({ required: true }) layer!: ImageLayer;
}
