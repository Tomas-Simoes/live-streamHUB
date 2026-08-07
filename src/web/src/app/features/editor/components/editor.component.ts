import { Component, signal } from '@angular/core';

import { Layer, LayerType } from '../../../shared/types/layer.types';
import {
  DragState,
  ResizeHandle,
  ResizeState,
  createDragState,
  createResizeState,
  getCanvasStyleValue,
  getDraggedPosition,
  getResizedLayer,
} from './canvas-coordinates';
import { EditorStore } from './editor.store';

@Component({
  selector: 'app-editor',
  standalone: false,
  templateUrl: './editor.component.html',
  styleUrls: ['../styles/editor.styles.css'],
  providers: [EditorStore],
})
export class EditorComponent {
  private dragState: DragState | null = null;
  private resizeState: ResizeState | null = null;

  getCanvasStyleValue = getCanvasStyleValue;

  LayerType = LayerType;
  resizeHandles: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  editingLayerId = signal<string | null>(null);
  draftLayerName = signal('');

  constructor(public editorStore: EditorStore) { }

  createLayer(type: LayerType) {
    const layer = this.editorStore.createLayer(type);

    this.editingLayerId.set(layer.id);
    this.draftLayerName.set(layer.name);
  }

  commitLayerName(layerId: string) {
    const name = this.draftLayerName().trim()

    if (!name) {
      this.editingLayerId.set(null)
      return
    }

    this.editorStore.renameLayer(layerId, name)

    this.editingLayerId.set(null)
  }

  startDrag(event: PointerEvent, layer: Layer, canvas: HTMLElement) {
    event.preventDefault();

    this.editorStore.selectLayer(layer.id);
    this.resizeState = null;
    this.dragState = createDragState(layer.id, layer.position, layer, event, canvas);

    document.addEventListener('pointermove', this.onDragMove);
    document.addEventListener('pointerup', this.stopDrag);
  }

  onDragMove = (event: PointerEvent) => {
    if (!this.dragState) {
      return;
    }

    this.editorStore.moveLayer(this.dragState.layerId, getDraggedPosition(event, this.dragState));
  };

  startResize(event: PointerEvent, handle: ResizeHandle, layer: Layer, canvas: HTMLElement) {
    event.preventDefault();
    event.stopPropagation();

    this.editorStore.selectLayer(layer.id);
    this.dragState = null;
    this.resizeState = createResizeState(layer, handle, event, canvas);

    document.addEventListener('pointermove', this.onResizeMove);
    document.addEventListener('pointerup', this.stopResize);
  }

  onResizeMove = (event: PointerEvent) => {
    if (!this.resizeState) {
      return;
    }

    this.editorStore.resizeLayer(this.resizeState.layerId, getResizedLayer(event, this.resizeState));
  };

  stopDrag = () => {
    this.dragState = null;

    document.removeEventListener('pointermove', this.onDragMove);
    document.removeEventListener('pointerup', this.stopDrag);
  };

  stopResize = () => {
    this.resizeState = null;

    document.removeEventListener('pointermove', this.onResizeMove);
    document.removeEventListener('pointerup', this.stopResize);
  };
}
