import { Component, Input } from '@angular/core';

import { Hub } from '../../../../shared/types/hub.types';
import { getHubBackground } from '../../../../shared/types/hub-background.types';
import { Layer, LayerType } from '../../../../shared/types/layer.types';

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
  readonly LayerType = LayerType;

  getLayerStyleValue(value: number, axis: 'x' | 'y') {
    return (value / (axis === 'x' ? CANVAS_WIDTH : CANVAS_HEIGHT)) * 100;
  }

  getLayerZIndex(layerIndex: number) {
    return this.hub.layers.length - layerIndex;
  }

  getLayerPreviewClass(layer: Layer) {
    return `preview-layer preview-layer-${layer.type.toLowerCase()}`;
  }

  getBackground() {
    const background = getHubBackground(this.hub.layout?.backgroundId);

    return background.id === 'transparent' ? 'transparent' : null;
  }

  getBackgroundImage() {
    const background = getHubBackground(this.hub.layout?.backgroundId);

    return background.src
      ? `linear-gradient(180deg, rgb(24 11 16 / 18%), rgb(24 11 16 / 24%)), url("${background.src}")`
      : null;
  }
}
