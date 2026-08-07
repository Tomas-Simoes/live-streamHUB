import { Component, Input } from '@angular/core';

import { EditorStore } from '../editor.store';
import { TextLayer } from '../../../../shared/types/layer.types';

@Component({
  selector: 'app-text-editor',
  standalone: false,
  template: `
    <section class="inspector-section" aria-label="Text settings">
      <label class="field-label">
        Text
        <input class="field-input" type="text" [value]="layer.text" (input)="updateText($event)" />
      </label>

      <label class="field-label">
        Font size
        <input class="field-input" type="number" min="1" [value]="layer.fontSize" (input)="updateFontSize($event)" />
      </label>

      <label class="field-label">
        Font family
        <input class="field-input" type="text" [value]="layer.fontFamily" (input)="updateFontFamily($event)" />
      </label>

      <label class="field-label">
        Color
        <input class="field-input field-input-color" type="color" [value]="layer.color" (input)="updateColor($event)" />
      </label>
    </section>
  `,
})
export class TextEditorComponent {
  @Input({ required: true }) layer!: TextLayer;

  constructor(private editorStore: EditorStore) { }

  updateText(event: Event) {
    this.editorStore.updateLayer(this.layer.id, { text: getInputValue(event) });
  }

  updateFontSize(event: Event) {
    this.editorStore.updateLayer(this.layer.id, { fontSize: getNumberValue(event) });
  }

  updateFontFamily(event: Event) {
    this.editorStore.updateLayer(this.layer.id, { fontFamily: getInputValue(event) });
  }

  updateColor(event: Event) {
    this.editorStore.updateLayer(this.layer.id, { color: getInputValue(event) });
  }
}

function getInputValue(event: Event) {
  return (event.target as HTMLInputElement).value;
}

function getNumberValue(event: Event) {
  return Number(getInputValue(event));
}
