import { Component, Input } from '@angular/core';

import { VideoLayer } from '../../../../shared/types/layer.types';

@Component({
  selector: 'app-video-loader',
  standalone: false,
  template: `
    @if(layer.src){
      <video
        class="video-layer"
        [src]="layer.src"
        [autoplay]="layer.autoplay"
        [muted]="layer.muted"
        playsinline
      ></video>
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

      .video-layer {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
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
export class VideoLoaderComponent {
  @Input({ required: true }) layer!: VideoLayer;
}
