import { Component, Input } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { fitLayerToNaturalSize } from '../canvas-coordinates';
import { EditorStore } from '../editor.store';
import { VideoLayer } from '../../../../shared/types/layer.types';
import { ImageApi, UploadedMedia } from '../../../../core/api/image.api';

@Component({
  selector: 'app-video-editor',
  standalone: false,
  template: `
    <section class="inspector-section" aria-label="Video settings">
      <label class="field-label">
        Upload video
        <span class="file-picker">
          <input class="file-input" type="file" accept="video/*" (change)="uploadVideo($event)" />
          <span class="file-picker-button">Choose video</span>
        </span>
      </label>

      <label class="field-label">
        Source URL
        <input class="field-input" type="text" placeholder="https://..." [value]="layer.src" (input)="updateSrc($event)" />
      </label>

      <label class="toggle-field">
        <input type="checkbox" [checked]="layer.autoplay" (change)="updateAutoplay($event)" />
        Autoplay
      </label>

      <label class="toggle-field">
        <input type="checkbox" [checked]="layer.muted" (change)="updateMuted($event)" />
        Muted
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
export class VideoEditorComponent {
  @Input({ required: true }) layer!: VideoLayer;

  constructor(
    private editorStore: EditorStore,
    private imageApi: ImageApi,
  ) { }

  updateSrc(event: Event) {
    this.updateVideoSource(getInputValue(event));
  }

  async uploadVideo(event: Event) {
    const file = getFileValue(event);

    if (!file) {
      return;
    }

    const layerId = this.layer.id;
    const previewSrc = URL.createObjectURL(file);

    revokeBlobUrl(this.layer.src);
    this.updateVideoSource(previewSrc, undefined, 'uploading', layerId);

    try {
      const uploaded = await firstValueFrom(this.imageApi.uploadVideo(file));

      revokeBlobUrl(previewSrc);
      const currentLayer = this.editorStore.getLayer(layerId);

      if (!currentLayer || !('src' in currentLayer) || currentLayer.src !== previewSrc) {
        return;
      }

      this.updateVideoSource(uploaded.url, uploaded, 'ready', layerId);
    } catch {
      const currentLayer = this.editorStore.getLayer(layerId);

      if (!currentLayer || !('src' in currentLayer) || currentLayer.src !== previewSrc) {
        revokeBlobUrl(previewSrc);
        return;
      }

      this.editorStore.updateLayer(layerId, {
        name: `${currentLayer.name} upload failed`,
        mediaUploadStatus: 'failed',
      });
    }
  }

  updateAutoplay(event: Event) {
    this.editorStore.updateLayer(this.layer.id, { autoplay: getCheckedValue(event) });
  }

  updateMuted(event: Event) {
    this.editorStore.updateLayer(this.layer.id, { muted: getCheckedValue(event) });
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

  private updateVideoSource(
    src: string,
    uploaded?: UploadedMedia,
    mediaUploadStatus?: VideoLayer['mediaUploadStatus'],
    layerId = this.layer.id,
  ) {
    this.editorStore.updateLayer(layerId, {
      src,
      mediaKey: uploaded?.key,
      mediaStorage: uploaded?.storage,
      mediaUploadStatus,
      localFilePath: uploaded?.localFilePath,
    });
    this.fitLayerToVideo(src, layerId).catch(() => undefined);
  }

  private async fitLayerToVideo(src: string, layerId: string) {
    if (!src) {
      return;
    }

    const naturalSize = await getVideoNaturalSize(src);
    const currentLayer = this.editorStore.getLayer(layerId);

    if (currentLayer && 'src' in currentLayer && currentLayer.src === src) {
      this.editorStore.resizeLayer(layerId, fitLayerToNaturalSize(currentLayer, naturalSize));
    }
  }
}

function getInputValue(event: Event) {
  return (event.target as HTMLInputElement).value;
}

function getCheckedValue(event: Event) {
  return (event.target as HTMLInputElement).checked;
}

function getFileValue(event: Event) {
  return (event.target as HTMLInputElement).files?.[0] ?? null;
}

function revokeBlobUrl(src: string) {
  if (src.startsWith('blob:')) {
    URL.revokeObjectURL(src);
  }
}

function getVideoNaturalSize(src: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const video = document.createElement('video');

    video.onloadedmetadata = () => resolve({
      width: video.videoWidth,
      height: video.videoHeight,
    });
    video.onerror = () => reject(new Error('Unable to load video dimensions'));
    video.src = src;
  });
}
