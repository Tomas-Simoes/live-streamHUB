import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OBS_TEXT_FONT_FAMILIES } from '../../../../shared/constants/obs-fonts.const';
import { ComponentPartStyle, EditorLayer, LayerType, LayerVisualStyle } from '../../../../shared/types/layer.types';
import { EditorStore } from '../editor.store';

type EditableStyle = LayerVisualStyle & ComponentPartStyle;
type FillMode = 'none' | 'solid' | 'gradient' | 'custom';
type Stop = { color: string; position: number; opacity: number };

const SCOREBUG_PARTS = [
  ['blue-team', 'Blue / Panel'], ['blue-logo', 'Blue / Logo'], ['blue-code', 'Blue / Name'],
  ['blue-seed', 'Blue / Seed'], ['blue-gold', 'Blue / Gold'], ['blue-towers', 'Blue / Towers'],
  ['blue-kills', 'Blue / Kills'], ['blue-objectives', 'Blue / Objectives'],
  ['center', 'Center / Score panel'], ['clock', 'Center / Clock'],
  ['red-kills', 'Red / Kills'], ['red-team', 'Red / Panel'], ['red-logo', 'Red / Logo'],
  ['red-code', 'Red / Name'], ['red-seed', 'Red / Seed'], ['red-gold', 'Red / Gold'],
  ['red-towers', 'Red / Towers'], ['red-objectives', 'Red / Objectives'],
].map(([key, label]) => ({ key, label }));
const ROSTER_PARTS = [
  ['row', 'Player row'], ['items', 'Item group'], ['item', 'Item slot'],
  ['portrait', 'Champion portrait'], ['level', 'Champion level'],
  ['name', 'Player name'], ['cs', 'Creep score'], ['gold', 'Player gold'], ['kda', 'K / D / A'],
].map(([key, label]) => ({ key, label }));
const SHADOWS = [
  { label: 'None', value: '' }, { label: 'Soft', value: '0 10px 24px rgb(0 0 0 / 28%)' },
  { label: 'Broadcast', value: '0 16px 32px rgb(0 0 0 / 42%)' },
  { label: 'Glow', value: '0 0 18px rgb(80 210 255 / 38%)' },
];
let copiedStyle: { scope: 'part' | 'layer'; style: EditableStyle } | null = null;

@Component({
  selector: 'app-layer-style-editor',
  standalone: false,
  styleUrls: ['./layer-style-editor.styles.css'],
  template: `
    <div class="visual-style-editor">
      @if(parts.length) {
      <div class="part-picker">
        <label class="field-label">Edit part
          <select class="field-input" [value]="selectedPartKey" (change)="selectedPartKeyChange.emit(inputValue($event))">
            <option value="" [selected]="!selectedPartKey">Whole layer</option>
            @for(part of parts; track part.key) {
            <option [value]="part.key" [selected]="selectedPartKey === part.key">{{ part.label }}{{ isOverridden(part.key) ? ' *' : '' }}</option>
            }
          </select>
        </label>
        @if(selectedPartKey) {
        <button class="reset-override" type="button" [disabled]="!isOverridden(selectedPartKey)"
          (click)="resetPart()">Reset part</button>
        }
      </div>
      }
      <div class="style-actions">
        <button type="button" [disabled]="!hasStyle" (click)="copyStyle()">Copy style</button>
        <button type="button" [disabled]="!hasCopiedStyle" (click)="pasteStyle()">Paste style</button>
      </div>
      <div class="style-group">
        <div class="style-group-title">Surface</div>
        <div class="fill-mode" role="group" aria-label="Fill type">
          @for(mode of fillModes; track mode.value) {
          <button type="button" class="fill-mode-button" [class.fill-mode-button-active]="fillMode === mode.value"
            [attr.aria-pressed]="fillMode === mode.value" (click)="setFillMode(mode.value)">{{ mode.label }}</button>
          }
        </div>
        @if(fillMode === 'solid') {
        <label class="field-label">Fill color
          <input class="field-input field-input-color" type="color" [value]="solidColor"
            (input)="update('backgroundColor', inputValue($event))" />
        </label>
        } @else if(fillMode === 'gradient') {
        <div class="gradient-preview" [style.background]="style.backgroundColor"></div>
        <label class="field-label">Direction <span class="field-value">{{ gradientAngle }}deg</span>
          <input class="field-input" type="range" min="0" max="360" step="5" [value]="gradientAngle"
            (input)="setGradientAngle($event)" />
        </label>
        <div class="gradient-stops">
          @for(stop of gradientStops; track $index; let index = $index) {
          <div class="gradient-stop">
            <input type="color" class="field-input field-input-color" [attr.aria-label]="'Stop ' + (index + 1) + ' color'"
              [value]="stop.color" (input)="setGradientStop(index, 'color', $event)" />
            <input type="number" class="field-input" min="0" max="100"
              [attr.aria-label]="'Stop ' + (index + 1) + ' position'" [value]="stop.position"
              (change)="setGradientStop(index, 'position', $event)" />
            <span class="stop-percent">%</span>
            <button class="remove-stop" type="button" title="Remove stop" [disabled]="gradientStops.length <= 2"
              (click)="removeGradientStop(index)">-</button>
          </div>
          <label class="stop-opacity">Stop opacity
            <input type="range" min="0" max="100" [value]="stop.opacity"
              (input)="setGradientStop(index, 'opacity', $event)" />
            <span>{{ stop.opacity }}%</span>
          </label>
          }
          <button class="add-stop" type="button" [disabled]="gradientStops.length >= 5"
            (click)="addGradientStop()">+ Add stop</button>
        </div>
        } @else if(fillMode === 'custom') {
        <label class="field-label">CSS fill
          <input class="field-input" type="text" [value]="style.backgroundColor || ''"
            (change)="update('backgroundColor', inputValue($event))" />
        </label>
        }
        <div class="field-grid">
          <label class="field-label">Text color
            <input class="field-input field-input-color" type="color" [value]="asHex(style.color, '#ffffff')"
              (input)="update('color', inputValue($event))" />
          </label>
          <label class="field-label">Opacity <span class="field-value">{{ style.opacity ?? 100 }}%</span>
            <input class="field-input" type="range" min="0" max="100" [value]="style.opacity ?? 100"
              (input)="updateNumber('opacity', $event)" />
          </label>
        </div>
      </div>
      @if(selectedPartKey) {
      <details class="style-subsection">
        <summary>Typography</summary>
        <div class="style-subsection-body">
          <label class="field-label">Font family
            <select class="field-input" [value]="style.fontFamily || ''" (change)="update('fontFamily', inputValue($event))">
              <option value="">Inherit</option>
              @if(style.fontFamily && !knownFont(style.fontFamily)) {
              <option [value]="style.fontFamily">{{ style.fontFamily }} (current)</option>
              }
              @for(font of fonts; track font) { <option [value]="font">{{ font }}</option> }
            </select>
          </label>
          <div class="field-grid">
            <label class="field-label">Size (px)
              <input class="field-input" type="number" min="1" placeholder="Inherit" [value]="style.fontSize ?? ''"
                (change)="updateOptionalNumber('fontSize', $event)" />
            </label>
            <label class="field-label">Weight
              <select class="field-input" [value]="style.fontWeight ?? ''"
                (change)="updateOptionalNumber('fontWeight', $event)">
                <option value="">Inherit</option><option value="400">Regular</option>
                <option value="600">Semibold</option><option value="700">Bold</option><option value="900">Black</option>
              </select>
            </label>
            <label class="field-label">Letter spacing (px)
              <input class="field-input" type="number" step="0.1" placeholder="Inherit"
                [value]="style.letterSpacing ?? ''" (change)="updateOptionalNumber('letterSpacing', $event)" />
            </label>
            <label class="field-label">Alignment
              <select class="field-input" [value]="style.textAlign || ''" (change)="update('textAlign', inputValue($event))">
                <option value="">Inherit</option><option value="left">Left</option>
                <option value="center">Center</option><option value="right">Right</option>
              </select>
            </label>
          </div>
        </div>
      </details>
      }
      <details class="style-subsection">
        <summary>Border & spacing</summary>
        <div class="style-subsection-body">
          <div class="field-grid">
            <label class="field-label">Border (px)
              <input class="field-input" type="number" min="0" [value]="style.borderWidth ?? 0"
                (change)="updateNumber('borderWidth', $event)" />
            </label>
            <label class="field-label">Border color
              <input class="field-input field-input-color" type="color" [value]="asHex(style.borderColor, '#ffffff')"
                (input)="update('borderColor', inputValue($event))" />
            </label>
            <label class="field-label">Radius (px)
              <input class="field-input" type="number" min="0" [value]="style.borderRadius ?? 0"
                (change)="updateNumber('borderRadius', $event)" />
            </label>
            <label class="field-label">Padding (px)
              <input class="field-input" type="number" min="0" [value]="style.padding ?? 0"
                (change)="updateNumber('padding', $event)" />
            </label>
          </div>
        </div>
      </details>
      <details class="style-subsection">
        <summary>Effects</summary>
        <div class="style-subsection-body">
          <label class="field-label">Shadow
            <select class="field-input" [value]="style.boxShadow || ''" (change)="update('boxShadow', inputValue($event))">
              @if(style.boxShadow && !knownShadow(style.boxShadow)) { <option [value]="style.boxShadow">Custom</option> }
              @for(preset of shadows; track preset.label) { <option [value]="preset.value">{{ preset.label }}</option> }
            </select>
          </label>
          <label class="field-label">Text shadow
            <input class="field-input" type="text" placeholder="0 2px 6px rgb(0 0 0 / 70%)"
              [value]="style.textShadow || ''" (change)="update('textShadow', inputValue($event))" />
          </label>
        </div>
      </details>
      @if(!selectedPartKey) {
      <details class="style-subsection">
        <summary>Advanced CSS</summary>
        <div class="style-subsection-body">
          <label class="field-label">Layer CSS
            <textarea class="field-input field-textarea" rows="7"
              placeholder="Declarations apply to this layer. Use & for the layer selector."
              [value]="style.customCss || ''" (input)="update('customCss', inputValue($event))"></textarea>
          </label>
        </div>
      </details>
      }
    </div>
  `,
})
export class LayerStyleEditorComponent {
  @Input({ required: true }) layer!: EditorLayer;
  @Input() selectedPartKey = '';
  @Output() selectedPartKeyChange = new EventEmitter<string>();
  readonly fillModes = [
    { value: 'none' as FillMode, label: 'None' }, { value: 'solid' as FillMode, label: 'Solid' },
    { value: 'gradient' as FillMode, label: 'Gradient' }, { value: 'custom' as FillMode, label: 'Custom' },
  ];
  readonly shadows = SHADOWS;
  readonly fonts = OBS_TEXT_FONT_FAMILIES;

  constructor(private editorStore: EditorStore) {}

  get parts() {
    return this.layer.type === LayerType.LolScorebug ? SCOREBUG_PARTS :
      this.layer.type === LayerType.LolPlayerRoster ? ROSTER_PARTS : [];
  }
  get style(): EditableStyle {
    if (this.selectedPartKey && (this.layer.type === LayerType.LolScorebug ||
      this.layer.type === LayerType.LolPlayerRoster)) {
      return this.layer.partStyles?.[this.selectedPartKey] ?? {};
    }
    return this.layer.style ?? {};
  }
  get hasStyle() { return Object.keys(this.style).length > 0; }
  get hasCopiedStyle() { return copiedStyle?.scope === (this.selectedPartKey ? 'part' : 'layer'); }

  copyStyle() {
    copiedStyle = { scope: this.selectedPartKey ? 'part' : 'layer', style: structuredClone(this.style) };
  }
  pasteStyle() {
    if (!this.hasCopiedStyle || !copiedStyle) return;
    if (this.selectedPartKey) {
      this.editorStore.updatePartStyle(this.layer.id, this.selectedPartKey, copiedStyle.style);
    } else {
      this.editorStore.updateLayerStyle(this.layer.id, copiedStyle.style);
    }
  }
  get fillMode(): FillMode {
    const fill = this.style.backgroundColor;
    if (!fill || fill === 'transparent') return 'none';
    if (this.parseGradient(fill)) return 'gradient';
    return /^#[\da-f]{6}$/i.test(fill) ? 'solid' : 'custom';
  }
  get solidColor() { return this.asHex(this.style.backgroundColor, '#25252c'); }
  get gradientAngle() { return this.parseGradient(this.style.backgroundColor)?.angle ?? 90; }
  get gradientStops(): Stop[] {
    return this.parseGradient(this.style.backgroundColor)?.stops ??
      [{ color: '#202631', position: 0, opacity: 100 }, { color: '#a64d4d', position: 100, opacity: 100 }];
  }
  isOverridden(key: string) {
    return (this.layer.type === LayerType.LolScorebug || this.layer.type === LayerType.LolPlayerRoster) &&
      !!this.layer.partStyles?.[key] && Object.keys(this.layer.partStyles[key]).length > 0;
  }
  resetPart() {
    if (this.selectedPartKey) this.editorStore.resetPartStyle(this.layer.id, this.selectedPartKey);
  }
  update(key: keyof EditableStyle, value: string | number) {
    if (this.selectedPartKey) {
      this.editorStore.updatePartStyle(this.layer.id, this.selectedPartKey, { [key]: value });
    } else {
      this.editorStore.updateLayerStyle(this.layer.id, { [key]: value });
    }
  }
  updateNumber(key: keyof EditableStyle, event: Event) {
    this.update(key, Number(this.inputValue(event)) || 0);
  }
  updateOptionalNumber(key: keyof EditableStyle, event: Event) {
    const value = this.inputValue(event);
    if (value !== '') this.update(key, Number(value));
  }
  inputValue(event: Event) {
    return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }
  setFillMode(mode: FillMode) {
    if (mode === this.fillMode) return;
    const fill = mode === 'none' ? 'transparent' : mode === 'solid' ? '#25252c' :
      mode === 'gradient' ? this.formatGradient(90, this.gradientStops) : this.style.backgroundColor || 'transparent';
    this.update('backgroundColor', fill);
  }
  setGradientAngle(event: Event) {
    this.update('backgroundColor', this.formatGradient(Number(this.inputValue(event)), this.gradientStops));
  }
  setGradientStop(index: number, key: keyof Stop, event: Event) {
    const stops = this.gradientStops.map((stop) => ({ ...stop }));
    if (key === 'color') stops[index].color = this.inputValue(event);
    else if (key === 'position') stops[index].position = Math.max(0, Math.min(100, Number(this.inputValue(event))));
    else stops[index].opacity = Math.max(0, Math.min(100, Number(this.inputValue(event))));
    this.update('backgroundColor', this.formatGradient(this.gradientAngle, stops));
  }
  addGradientStop() {
    const stops = this.gradientStops;
    if (stops.length >= 5) return;
    const midpoint = Math.round((stops[stops.length - 2].position + stops[stops.length - 1].position) / 2);
    stops.splice(stops.length - 1, 0, { color: '#777777', position: midpoint, opacity: 100 });
    this.update('backgroundColor', this.formatGradient(this.gradientAngle, stops));
  }
  removeGradientStop(index: number) {
    const stops = this.gradientStops;
    if (stops.length <= 2) return;
    stops.splice(index, 1);
    this.update('backgroundColor', this.formatGradient(this.gradientAngle, stops));
  }
  asHex(value: string | undefined, fallback: string) {
    if (value && /^#[\da-f]{6}$/i.test(value)) return value;
    const match = value?.match(/^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)/i);
    return match ? '#' + match.slice(1, 4).map((channel) => Number(channel).toString(16).padStart(2, '0')).join('') : fallback;
  }
  knownShadow(value: string) { return this.shadows.some((preset) => preset.value === value); }
  knownFont(value: string) { return (this.fonts as readonly string[]).includes(value); }
  private formatGradient(angle: number, stops: Stop[]) {
    return `linear-gradient(${angle}deg, ${stops.map((stop) => {
      const alpha = Math.round((stop.opacity / 100) * 255).toString(16).padStart(2, '0');
      return `${stop.color}${alpha} ${stop.position}%`;
    }).join(', ')})`;
  }
  private parseGradient(value: string | undefined): { angle: number; stops: Stop[] } | null {
    const match = value?.match(/^linear-gradient\((\d+)deg, (.+)\)$/i);
    if (!match) return null;
    const stops = match[2].split(', ').map((stop) => {
      const parsed = stop.match(/^(#[\da-f]{6})([\da-f]{2})? (\d+)%$/i);
      return parsed ? {
        color: parsed[1], opacity: parsed[2] ? Math.round((parseInt(parsed[2], 16) / 255) * 100) : 100,
        position: Number(parsed[3]),
      } : null;
    });
    return stops.length >= 2 && stops.every((stop) => !!stop) ?
      { angle: Number(match[1]), stops: stops as Stop[] } : null;
  }
}
