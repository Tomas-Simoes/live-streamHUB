import { Component, Input } from '@angular/core';

import { fitLayerToNaturalSize } from '../canvas-coordinates';
import { EditorStore } from '../editor.store';
import { VideoLayer } from '../../../../shared/types/layer.types';

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
    </section>
  `,
})
export class VideoEditorComponent {
  @Input({ required: true }) layer!: VideoLayer;

  constructor(private editorStore: EditorStore) { }

  updateSrc(event: Event) {
    this.updateVideoSource(getInputValue(event));
  }

  uploadVideo(event: Event) {
    const file = getFileValue(event);

    if (!file) {
      return;
    }

    const src = URL.createObjectURL(file);

    revokeBlobUrl(this.layer.src);
    this.updateVideoSource(src);
  }

  updateAutoplay(event: Event) {
    this.editorStore.updateLayer(this.layer.id, { autoplay: getCheckedValue(event) });
  }

  updateMuted(event: Event) {
    this.editorStore.updateLayer(this.layer.id, { muted: getCheckedValue(event) });
  }

  private updateVideoSource(src: string) {
    this.editorStore.updateLayer(this.layer.id, { src });
    this.fitLayerToVideo(src).catch(() => undefined);
  }

  private async fitLayerToVideo(src: string) {
    if (!src) {
      return;
    }

    const naturalSize = await getVideoNaturalSize(src);

    this.editorStore.resizeLayer(this.layer.id, fitLayerToNaturalSize(this.layer, naturalSize));
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
