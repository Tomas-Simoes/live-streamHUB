import { Component, Input } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { fitLayerToNaturalSize } from '../canvas-coordinates';
import { EditorStore } from '../editor.store';
import { ImageLayer } from '../../../../shared/types/layer.types';
import { ImageApi, UploadedMedia } from '../../../../core/api/image.api';

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

      <div class="field-grid">
        <label class="field-label">
          Fit
          <select class="field-input" [value]="layer.fit || 'cover'" (change)="updateFit($event)">
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
            <option value="fill">Fill</option>
          </select>
        </label>

        <label class="field-label">
          Position
          <input class="field-input" type="text" placeholder="center" [value]="layer.objectPosition || 'center'"
            (input)="updateObjectPosition($event)" />
        </label>
      </div>
    </section>
  `,
})
export class ImageEditorComponent {
  @Input({ required: true }) layer!: ImageLayer;

  constructor(
    private editorStore: EditorStore,
    private imageApi: ImageApi,
  ) {}

  updateSrc(event: Event) {
    this.updateImageSource(getInputValue(event));
  }

  async uploadImage(event: Event) {
    const file = getFileValue(event);

    if (!file) {
      return;
    }

    const layerId = this.layer.id;
    const previewSrc = URL.createObjectURL(file);

    revokeBlobUrl(this.layer.src);
    this.updateImageSource(
      previewSrc,
      this.layer.alt || file.name,
      undefined,
      'uploading',
      layerId,
    );

    try {
      const uploaded = await firstValueFrom(this.imageApi.uploadImage(file));

      revokeBlobUrl(previewSrc);
      const currentLayer = this.editorStore.getLayer(layerId);

      if (!currentLayer || !('src' in currentLayer) || currentLayer.src !== previewSrc) {
        return;
      }

      this.updateImageSource(
        uploaded.url,
        ('alt' in currentLayer ? currentLayer.alt : '') || uploaded.originalName,
        uploaded,
        'ready',
        layerId,
      );
    } catch {
      const currentLayer = this.editorStore.getLayer(layerId);

      if (!currentLayer || !('src' in currentLayer) || currentLayer.src !== previewSrc) {
        revokeBlobUrl(previewSrc);
        return;
      }

      this.editorStore.updateLayer(layerId, {
        alt: ('alt' in currentLayer ? currentLayer.alt : '') || `${file.name} upload failed`,
        mediaUploadStatus: 'failed',
      });
    }
  }

  updateAlt(event: Event) {
    this.editorStore.updateLayer(this.layer.id, { alt: getInputValue(event) });
  }

  updateOpacity(event: Event) {
    this.editorStore.updateLayer(this.layer.id, { opacity: getNumberValue(event) });
  }

  updateFit(event: Event) {
    const fit = getInputValue(event);

    this.editorStore.updateLayer(this.layer.id, {
      fit: fit === 'contain' || fit === 'fill' ? fit : 'cover',
    });
  }

  updateObjectPosition(event: Event) {
    this.editorStore.updateLayer(this.layer.id, {
      objectPosition: getInputValue(event),
    });
  }

  private updateImageSource(
    src: string,
    alt = this.layer.alt,
    uploaded?: UploadedMedia,
    mediaUploadStatus?: ImageLayer['mediaUploadStatus'],
    layerId = this.layer.id,
  ) {
    this.editorStore.updateLayer(layerId, {
      src,
      alt,
      mediaKey: uploaded?.key,
      mediaStorage: uploaded?.storage,
      mediaUploadStatus,
      localFilePath: uploaded?.localFilePath,
    });
    this.fitLayerToImage(src, layerId).catch(() => undefined);
  }

  private async fitLayerToImage(src: string, layerId: string) {
    if (!src) {
      return;
    }

    const naturalSize = await getImageNaturalSize(src);
    const currentLayer = this.editorStore.getLayer(layerId);

    if (currentLayer && 'src' in currentLayer && currentLayer.src === src) {
      this.editorStore.resizeLayer(layerId, fitLayerToNaturalSize(currentLayer, naturalSize));
    }
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
