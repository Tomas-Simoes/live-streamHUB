import { Component, Input } from '@angular/core';

import { fitLayerToNaturalSize } from '../canvas-coordinates';
import { EditorStore } from '../editor.store';
import { ImageLayer } from '../../../../shared/types/layer.types';

@Component({
  selector: 'app-image-editor',
  standalone: false,
  template: `
    <section class="inspector-section" aria-label="Image settings">
      <label class="field-label">
        Upload image
        <span class="file-picker">
          <input class="file-input" type="file" accept="image/*" (change)="uploadImage($event)" />
          <span class="file-picker-button">Choose image</span>
        </span>
      </label>

      <label class="field-label">
        Source URL
        <input class="field-input" type="text" placeholder="https://..." [value]="layer.src" (input)="updateSrc($event)" />
      </label>

      <label class="field-label">
        Alt text
        <input class="field-input" type="text" [value]="layer.alt" (input)="updateAlt($event)" />
      </label>

      <label class="field-label">
        Opacity
        <input class="field-input" type="range" min="0" max="100" [value]="layer.opacity" (input)="updateOpacity($event)" />
      </label>
    </section>
  `,
})
export class ImageEditorComponent {
  @Input({ required: true }) layer!: ImageLayer;

  constructor(private editorStore: EditorStore) { }

  updateSrc(event: Event) {
    this.updateImageSource(getInputValue(event));
  }

  uploadImage(event: Event) {
    const file = getFileValue(event);

    if (!file) {
      return;
    }

    const src = URL.createObjectURL(file);

    revokeBlobUrl(this.layer.src);
    this.updateImageSource(src, this.layer.alt || file.name);
  }

  updateAlt(event: Event) {
    this.editorStore.updateLayer(this.layer.id, { alt: getInputValue(event) });
  }

  updateOpacity(event: Event) {
    this.editorStore.updateLayer(this.layer.id, { opacity: getNumberValue(event) });
  }

  private updateImageSource(src: string, alt = this.layer.alt) {
    this.editorStore.updateLayer(this.layer.id, { src, alt });
    this.fitLayerToImage(src).catch(() => undefined);
  }

  private async fitLayerToImage(src: string) {
    if (!src) {
      return;
    }

    const naturalSize = await getImageNaturalSize(src);

    this.editorStore.resizeLayer(this.layer.id, fitLayerToNaturalSize(this.layer, naturalSize));
  }
}

function getInputValue(event: Event) {
  return (event.target as HTMLInputElement).value;
}

function getNumberValue(event: Event) {
  return Number(getInputValue(event));
}

function getFileValue(event: Event) {
  return (event.target as HTMLInputElement).files?.[0] ?? null;
}

function revokeBlobUrl(src: string) {
  if (src.startsWith('blob:')) {
    URL.revokeObjectURL(src);
  }
}

function getImageNaturalSize(src: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve({
      width: image.naturalWidth,
      height: image.naturalHeight,
    });
    image.onerror = () => reject(new Error('Unable to load image dimensions'));
    image.src = src;
  });
}
