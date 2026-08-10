import { Component, Input } from '@angular/core';

import { Hub } from '../../../../shared/types/hub.types';
import { Layer } from '../../../../shared/types/layer.types';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

@Component({
  selector: 'app-hub-preview',
  standalone: false,
  templateUrl: './hub-preview.component.html',
  styleUrls: ['./hub-preview.styles.css'],
})
export class HubPreviewComponent {
  @Input({ required: true }) hub!: Hub;

  getLayerStyleValue(value: number, axis: 'x' | 'y') {
    return (value / (axis === 'x' ? CANVAS_WIDTH : CANVAS_HEIGHT)) * 100;
  }

  getLayerPreviewClass(layer: Layer) {
    return `preview-layer preview-layer-${layer.type.toLowerCase()}`;
  }
}
