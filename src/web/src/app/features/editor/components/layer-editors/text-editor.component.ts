import { Component, Input } from '@angular/core';

import { EditorStore } from '../editor.store';
import { OBS_TEXT_FONT_FAMILIES } from '../../../../shared/constants/obs-fonts.const';
import { TextAlign, TextLayer } from '../../../../shared/types/layer.types';

@Component({
  selector: 'app-text-editor',
  standalone: false,
  template: `
    <section class="inspector-section" aria-label="Text settings">
      @if(mode === 'content') {
      <label class="field-label">
        Text
        <input class="field-input" type="text" [value]="layer.text" (input)="updateText($event)" />
      </label>
      } @else {

      <label class="field-label">
        Font size
        <input class="field-input" type="number" min="1" [value]="layer.fontSize" (input)="updateFontSize($event)" />
      </label>

      <label class="field-label">
        Weight
        <select class="field-input" [value]="layer.fontWeight || (layer.bold ? 700 : 400)" (change)="updateFontWeight($event)">
          <option [value]="300">Light</option>
          <option [value]="400">Regular</option>
          <option [value]="500">Medium</option>
          <option [value]="700">Bold</option>
          <option [value]="900">Black</option>
        </select>
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
          <button
            class="text-style-button"
            type="button"
            title="Uppercase"
            aria-label="Uppercase"
            [class.text-style-button-active]="layer.uppercase"
            [attr.aria-pressed]="layer.uppercase ? 'true' : 'false'"
            (click)="toggleUppercase()"
          >
            AA
          </button>
        </div>
      </div>

      <label class="field-label">
        Color
        <input class="field-input field-input-color" type="color" [value]="layer.color" (input)="updateColor($event)" />
      </label>

      <div class="field-grid">
        <label class="field-label">
          Align
          <select class="field-input" [value]="layer.textAlign || 'center'" (change)="updateTextAlign($event)">
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>

        <label class="field-label">
          Letter
          <input class="field-input" type="number" [value]="layer.letterSpacing ?? 0"
            (input)="updateLetterSpacing($event)" />
        </label>

        <label class="field-label">
          Line
          <input class="field-input" type="number" min="0.5" step="0.05" [value]="layer.lineHeight || 1.15"
            (input)="updateLineHeight($event)" />
        </label>
      </div>
      }
    </section>
  `,
})
export class TextEditorComponent {
  @Input({ required: true }) layer!: TextLayer;
  @Input() mode: 'content' | 'typography' = 'content';
  readonly obsTextFontFamilies = OBS_TEXT_FONT_FAMILIES;

  constructor(private editorStore: EditorStore) { }

  updateText(event: Event) {
    this.editorStore.updateLayer(this.layer.id, { text: getInputValue(event) });
  }

  updateFontSize(event: Event) {
    this.editorStore.updateLayer(this.layer.id, { fontSize: getNumberValue(event) });
  }

  updateFontWeight(event: Event) {
    const fontWeight = getNumberValue(event);

    this.editorStore.updateLayer(this.layer.id, {
      fontWeight,
      bold: fontWeight >= 700,
    });
  }

  updateFontFamily(event: Event) {
    this.editorStore.updateLayer(this.layer.id, { fontFamily: getInputValue(event) });
  }

  isBold() {
    return this.layer.bold === true;
  }

  toggleBold() {
    const bold = !this.isBold();

    this.editorStore.updateLayer(this.layer.id, {
      bold,
      fontWeight: bold ? 700 : 400,
    });
  }

  toggleUppercase() {
    this.editorStore.updateLayer(this.layer.id, { uppercase: !this.layer.uppercase });
  }

  isKnownFontFamily(fontFamily: string) {
    return (this.obsTextFontFamilies as readonly string[]).includes(fontFamily);
  }

  updateColor(event: Event) {
    this.editorStore.updateLayer(this.layer.id, { color: getInputValue(event) });
  }

  updateTextAlign(event: Event) {
    this.editorStore.updateLayer(this.layer.id, {
      textAlign: getTextAlignValue(event),
    });
  }

  updateLetterSpacing(event: Event) {
    this.editorStore.updateLayer(this.layer.id, {
      letterSpacing: getNumberValue(event),
    });
  }

  updateLineHeight(event: Event) {
    this.editorStore.updateLayer(this.layer.id, {
      lineHeight: getNumberValue(event),
    });
  }
}

function getInputValue(event: Event) {
  return (event.target as HTMLInputElement).value;
}

function getNumberValue(event: Event) {
  return Number(getInputValue(event));
}

function getTextAlignValue(event: Event): TextAlign {
  const value = getInputValue(event);

  return value === 'left' || value === 'right' ? value : 'center';
}
