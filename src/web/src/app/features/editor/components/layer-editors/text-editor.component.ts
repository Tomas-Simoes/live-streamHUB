import { Component, Input } from '@angular/core';

import { EditorStore } from '../editor.store';
import { OBS_TEXT_FONT_FAMILIES } from '../../../../shared/constants/obs-fonts.const';
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
        <select class="field-input" [value]="layer.fontFamily" (change)="updateFontFamily($event)">
          @if(!isKnownFontFamily(layer.fontFamily)) {
          <option [value]="layer.fontFamily">{{ layer.fontFamily }} (custom)</option>
          }

          @for(fontFamily of obsTextFontFamilies; track fontFamily) {
          <option [value]="fontFamily">{{ fontFamily }}</option>
          }
        </select>
      </label>

      <div class="field-label">
        Style
        <div class="text-style-toolbar" role="toolbar" aria-label="Text style">
          <button
            class="text-style-button"
            type="button"
            title="Bold"
            aria-label="Bold"
            [class.text-style-button-active]="isBold()"
            [attr.aria-pressed]="isBold() ? 'true' : 'false'"
            (click)="toggleBold()"
          >
            B
          </button>
        </div>
      </div>

      <label class="field-label">
        Color
        <input class="field-input field-input-color" type="color" [value]="layer.color" (input)="updateColor($event)" />
      </label>
    </section>
  `,
})
export class TextEditorComponent {
  @Input({ required: true }) layer!: TextLayer;
  readonly obsTextFontFamilies = OBS_TEXT_FONT_FAMILIES;

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

  isBold() {
    return this.layer.bold === true;
  }

  toggleBold() {
    this.editorStore.updateLayer(this.layer.id, { bold: !this.isBold() });
  }

  isKnownFontFamily(fontFamily: string) {
    return (this.obsTextFontFamilies as readonly string[]).includes(fontFamily);
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
