import { AfterViewInit, Component, DoCheck, ElementRef, Input, OnDestroy, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayerLoadersModule } from '../../../editor/layer-loaders.module';

import { Hub } from '../../../../shared/types/hub.types';
import { getHubBackground } from '../../../../shared/types/hub-background.types';
import { EditorLayer, Layer, LayerType } from '../../../../shared/types/layer.types';
import {
  LayerStyleSheet,
  getLayerBorderStyle,
  getLayerOpacity,
} from '../../../../shared/helpers/layer-style.helpers';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

@Component({
  selector: 'app-hub-preview',
  standalone: true,
  imports: [CommonModule, LayerLoadersModule],
  templateUrl: './hub-preview.component.html',
  styleUrls: ['./hub-preview.styles.css'],
})
export class HubPreviewComponent implements AfterViewInit, DoCheck, OnDestroy {
  @Input({ required: true }) hub!: Hub;
  @ViewChild('previewShell', { static: true }) private previewShell!: ElementRef<HTMLElement>;
  readonly LayerType = LayerType;
  readonly previewScale = signal(0);
  private scopedStyleSheet = new LayerStyleSheet();
  private resizeObserver?: ResizeObserver;

  ngAfterViewInit() {
    // Render at the broadcast's native resolution, then scale the whole surface.
    // This also scales pixel-based font limits, borders, padding, and custom CSS.
    this.resizeObserver = new ResizeObserver(([entry]) => {
      this.previewScale.set(entry.contentRect.width / CANVAS_WIDTH);
    });
    this.resizeObserver.observe(this.previewShell.nativeElement);
  }

  ngDoCheck() {
    this.scopedStyleSheet.update(this.hub?.layers ?? []);
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    this.scopedStyleSheet.destroy();
  }

  getLayerStyleValue(value: number, axis: 'x' | 'y') {
    return (value / (axis === 'x' ? CANVAS_WIDTH : CANVAS_HEIGHT)) * 100;
  }

  getLayerZIndex(layerIndex: number) {
    return this.hub.layers.length - layerIndex;
  }

  getLayerPreviewClass(layer: Layer) {
    return `preview-layer preview-layer-${layer.type.toLowerCase()}`;
  }

  getLayerBackground(layer: EditorLayer) {
    return layer.style?.backgroundColor ?? null;
  }

  getLayerColor(layer: EditorLayer) {
    return layer.style?.color ?? null;
  }

  getLayerOpacity(layer: EditorLayer) {
    return getLayerOpacity(layer.style);
  }

  getLayerBorderColor(layer: EditorLayer) {
    return layer.style?.borderColor ?? null;
  }

  getLayerBorderWidth(layer: EditorLayer) {
    return layer.style?.borderWidth ?? null;
  }

  getLayerBorderStyle(layer: EditorLayer) {
    return getLayerBorderStyle(layer.style);
  }

  getLayerBorderRadius(layer: EditorLayer) {
    return layer.style?.borderRadius ?? null;
  }

  getLayerPadding(layer: EditorLayer) {
    return layer.style?.padding ?? null;
  }

  getLayerBoxShadow(layer: EditorLayer) {
    return layer.style?.boxShadow ?? null;
  }

  getLayerTextShadow(layer: EditorLayer) {
    return layer.style?.textShadow ?? null;
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
