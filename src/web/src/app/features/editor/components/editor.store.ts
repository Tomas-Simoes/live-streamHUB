import { Injectable, computed, signal } from '@angular/core';

import { CANVAS_SIZE } from './canvas-coordinates';
import { EditorLayer, Layer, LayerType, Vector2 } from '../../../shared/types/layer.types';

@Injectable()
export class EditorStore {
  layers = signal<EditorLayer[]>([]);
  selectedLayerId = signal<string | null>(null);
  selectedLayer = computed(() => {
    const selectedLayerId = this.selectedLayerId();

    return this.layers().find((layer) => layer.id === selectedLayerId) ?? null;
  });

  createLayer(type: LayerType) {
    const baseLayer: Layer = {
      id: crypto.randomUUID(),
      name: 'New ' + type,
      type,
      visible: true,
      position: { x: CANVAS_SIZE.width / 2, y: CANVAS_SIZE.height / 2 },
      width: 200,
      height: 200,
    };
    let layer: EditorLayer;

    switch (type) {
      case LayerType.Text:
        layer = {
          ...baseLayer,
          type: LayerType.Text,
          width: 170,
          height: 48,
          text: 'New text',
          fontSize: 32,
          fontFamily: 'Inter',
          color: '#fff1d2',
        };
        break;
      case LayerType.Image:
        layer = {
          ...baseLayer,
          type: LayerType.Image,
          src: '',
          alt: '',
          opacity: 100,
        };
        break;
      case LayerType.Video:
        layer = {
          ...baseLayer,
          type: LayerType.Video,
          src: '',
          autoplay: true,
          muted: true,
        };
        break;
      case LayerType.Kills:
        layer = {
          ...baseLayer,
          type: LayerType.Kills,
        };
        break;
      case LayerType.Towers:
        layer = {
          ...baseLayer,
          type: LayerType.Towers,
        };
        break;
      case LayerType.Group:
        layer = {
          ...baseLayer,
          type: LayerType.Group,
        };
        break;
    }

    this.layers.update((layers) => [layer, ...layers]);
    this.selectLayer(layer.id);

    return layer;
  }

  selectLayer(layerId: string) {
    this.selectedLayerId.set(layerId);
  }

  moveLayer(layerId: string, position: Vector2) {
    this.layers.update((layers) =>
      layers.map((layer) =>
        layer.id === layerId
          ? {
            ...layer,
            position,
          }
          : layer
      )
    );
  }

  resizeLayer(layerId: string, size: Pick<Layer, 'position' | 'width' | 'height'>) {
    this.layers.update((layers) =>
      layers.map((layer) =>
        layer.id === layerId
          ? {
            ...layer,
            ...size,
          }
          : layer
      )
    );
  }

  updateLayer(layerId: string, changes: Partial<EditorLayer>) {
    this.layers.update((layers) =>
      layers.map((layer) =>
        layer.id === layerId
          ? ({
            ...layer,
            ...changes,
          } as EditorLayer)
          : layer
      )
    );
  }

  renameLayer(layerId: string, name: string) {
    this.layers.update((layers) =>
      layers.map((layer) =>
        layer.id === layerId
          ? {
            ...layer,
            name,
          }
          : layer
      )
    );
  }
}
