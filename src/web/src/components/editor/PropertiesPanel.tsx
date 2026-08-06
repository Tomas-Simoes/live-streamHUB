import { useState } from 'react';
import type { EditorCopy } from '../../i18n/editorText';
import { DATA_BINDINGS, getBindingDefinition } from '../../services/dataBindings';
import type { HubElement } from '../../types/hub';

interface NumberInputProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

interface PropertiesPanelProps {
  selectedElement?: HubElement;
  copy: EditorCopy;
  onPatchElement: (patch: Partial<HubElement>) => void;
  onPatchStyle: (patch: Partial<HubElement['style']>) => void;
  onPatchContent: (patch: Partial<HubElement['content']>) => void;
  onDelete: () => void;
}

type InspectorTab = 'layout' | 'content' | 'style';

const FONT_FAMILIES = [
  { label: 'Broadcast Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Editorial Sans', value: 'Inter, Arial, sans-serif' },
  { label: 'Scoreboard Mono', value: '"Courier New", Courier, monospace' },
  { label: 'Condensed Poster', value: '"Arial Narrow", "Roboto Condensed", Arial, sans-serif' },
];

const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800, 900];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function fieldNumber(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function hexColor(value: string | undefined, fallback: string): string {
  return value && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
}

function NumberInput({ label, value, min, max, onChange }: NumberInputProps) {
  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={Math.round(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function PropertiesPanel({
  selectedElement,
  copy,
  onPatchElement,
  onPatchStyle,
  onPatchContent,
  onDelete,
}: PropertiesPanelProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('layout');

  return (
    <section className="tool-section inspector">
      <div className="section-heading compact-heading">
        <p className="eyebrow">{copy.inspector}</p>
        <h2>{selectedElement ? selectedElement.name : copy.noSelection}</h2>
      </div>

      {selectedElement ? (
        <>
          <label className="element-name-field">
            {copy.name}
            <input value={selectedElement.name} onChange={(event) => onPatchElement({ name: event.target.value })} />
          </label>

          <div className="sidebar-tabs inspector-tabs" aria-label="Element properties">
            {(['layout', 'content', 'style'] as const).map((tab) => (
              <button
                key={tab}
                className={activeTab === tab ? 'active' : ''}
                type="button"
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'layout' ? copy.layout : tab === 'content' ? copy.content : copy.appearance}
              </button>
            ))}
          </div>

          {activeTab === 'layout' ? (
            <div className="inspector-pane">
              <div className="inspector-group">
                <p className="mini-heading">{copy.layout}</p>
                <div className="form-grid four-columns">
                  <NumberInput
                    label={copy.x}
                    value={selectedElement.x}
                    onChange={(value) => onPatchElement({ x: value })}
                  />
                  <NumberInput
                    label={copy.y}
                    value={selectedElement.y}
                    onChange={(value) => onPatchElement({ y: value })}
                  />
                  <NumberInput
                    label={copy.width}
                    value={selectedElement.width}
                    min={36}
                    onChange={(value) => onPatchElement({ width: value })}
                  />
                  <NumberInput
                    label={copy.height}
                    value={selectedElement.height}
                    min={36}
                    onChange={(value) => onPatchElement({ height: value })}
                  />
                </div>

                <div className="form-grid two-columns">
                  <NumberInput
                    label={copy.zIndex}
                    value={selectedElement.zIndex}
                    min={1}
                    onChange={(value) => onPatchElement({ zIndex: value })}
                  />
                  <NumberInput
                    label={copy.rotate}
                    value={selectedElement.rotation ?? 0}
                    onChange={(value) => onPatchElement({ rotation: value })}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'content' ? (
            <div className="inspector-pane">
              {selectedElement.type === 'text' ? (
                <div className="inspector-group">
                  <p className="mini-heading">{copy.content}</p>
                  <label>
                    {copy.textValue}
                    <textarea
                      value={selectedElement.content.text || ''}
                      onChange={(event) => onPatchContent({ text: event.target.value })}
                    />
                  </label>
                </div>
              ) : null}

              {selectedElement.type === 'image' ? (
                <div className="inspector-group">
                  <p className="mini-heading">{copy.image}</p>
                  <label>
                    {copy.imageUrl}
                    <input
                      value={selectedElement.content.src || ''}
                      onChange={(event) => onPatchContent({ src: event.target.value })}
                    />
                  </label>
                  <label>
                    {copy.imageFit}
                    <div className="segmented-control">
                      {(['cover', 'contain', 'fill'] as const).map((fit) => (
                        <button
                          key={fit}
                          className={(selectedElement.style.objectFit ?? 'cover') === fit ? 'active' : ''}
                          type="button"
                          onClick={() => onPatchStyle({ objectFit: fit })}
                        >
                          {copy[fit]}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>
              ) : null}

              {selectedElement.type === 'data-widget' ? (
                <div className="inspector-group">
                  <p className="mini-heading">{copy.content}</p>
                  <label>
                    {copy.binding}
                    <select
                      value={selectedElement.dataBinding || ''}
                      onChange={(event) => {
                        const binding = getBindingDefinition(event.target.value);
                        onPatchElement({
                          dataBinding: event.target.value,
                          name: binding?.label || selectedElement.name,
                          content: {
                            ...selectedElement.content,
                            label: binding?.label.toUpperCase(),
                          },
                        });
                      }}
                    >
                      {DATA_BINDINGS.map((binding) => (
                        <option key={binding.key} value={binding.key}>
                          {binding.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedElement.content.showLabel)}
                      onChange={(event) => onPatchContent({ showLabel: event.target.checked })}
                    />
                    <span>{copy.showLabel}</span>
                  </label>
                  <div className="form-grid two-columns">
                    <label>
                      {copy.label}
                      <input
                        value={selectedElement.content.label || ''}
                        onChange={(event) => onPatchContent({ label: event.target.value })}
                      />
                    </label>
                    <label>
                      {copy.prefix}
                      <input
                        value={selectedElement.content.prefix || ''}
                        onChange={(event) => onPatchContent({ prefix: event.target.value })}
                      />
                    </label>
                  </div>
                  <label>
                    {copy.suffix}
                    <input
                      value={selectedElement.content.suffix || ''}
                      onChange={(event) => onPatchContent({ suffix: event.target.value })}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === 'style' ? (
            <div className="inspector-pane">
              {selectedElement.type !== 'image' ? (
                <div className="inspector-group">
                  <p className="mini-heading">{copy.typography}</p>
                  <label>
                    {copy.fontFamily}
                    <select
                      value={selectedElement.style.fontFamily || FONT_FAMILIES[0].value}
                      onChange={(event) => onPatchStyle({ fontFamily: event.target.value })}
                    >
                      {FONT_FAMILIES.map((font) => (
                        <option key={font.value} value={font.value}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form-grid two-columns">
                    <NumberInput
                      label={copy.font}
                      value={fieldNumber(selectedElement.style.fontSize)}
                      min={8}
                      max={180}
                      onChange={(value) => onPatchStyle({ fontSize: value })}
                    />
                    <label>
                      {copy.fontWeight}
                      <select
                        value={selectedElement.style.fontWeight || 700}
                        onChange={(event) => onPatchStyle({ fontWeight: Number(event.target.value) })}
                      >
                        {FONT_WEIGHTS.map((weight) => (
                          <option key={weight} value={weight}>
                            {weight}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="form-grid two-columns">
                    <NumberInput
                      label={copy.lineHeight}
                      value={(selectedElement.style.lineHeight ?? 1.08) * 100}
                      min={70}
                      max={220}
                      onChange={(value) => onPatchStyle({ lineHeight: clamp(value, 70, 220) / 100 })}
                    />
                    <NumberInput
                      label={copy.letterSpacing}
                      value={fieldNumber(selectedElement.style.letterSpacing)}
                      min={-8}
                      max={32}
                      onChange={(value) => onPatchStyle({ letterSpacing: value })}
                    />
                  </div>
                  <label>
                    {copy.align}
                    <div className="segmented-control">
                      {(['left', 'center', 'right'] as const).map((align) => (
                        <button
                          key={align}
                          className={selectedElement.style.textAlign === align ? 'active' : ''}
                          type="button"
                          onClick={() => onPatchStyle({ textAlign: align })}
                        >
                          {copy[align]}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>
              ) : null}

              <div className="inspector-group">
                <p className="mini-heading">{copy.appearance}</p>
                {selectedElement.type !== 'image' ? (
                  <label>
                    {copy.color}
                    <input
                      type="color"
                      value={hexColor(selectedElement.style.color, '#ffffff')}
                      onChange={(event) => onPatchStyle({ color: event.target.value })}
                    />
                  </label>
                ) : null}

                <label>
                  {copy.background}
                  <div className="compound-control">
                    <input
                      value={selectedElement.style.backgroundColor || 'transparent'}
                      onChange={(event) => onPatchStyle({ backgroundColor: event.target.value })}
                    />
                    <button type="button" onClick={() => onPatchStyle({ backgroundColor: 'transparent' })}>
                      {copy.noBackground}
                    </button>
                  </div>
                </label>

                <div className="form-grid two-columns">
                  <NumberInput
                    label={copy.opacity}
                    value={Math.round((selectedElement.style.opacity ?? 1) * 100)}
                    min={0}
                    max={100}
                    onChange={(value) => onPatchStyle({ opacity: clamp(value, 0, 100) / 100 })}
                  />
                  <NumberInput
                    label={copy.padding}
                    value={fieldNumber(selectedElement.style.padding)}
                    min={0}
                    max={80}
                    onChange={(value) => onPatchStyle({ padding: value })}
                  />
                </div>
              </div>

              <div className="inspector-group">
                <p className="mini-heading">{copy.shadow}</p>
                {selectedElement.type !== 'image' ? (
                  <label>
                    {copy.textShadow}
                    <input
                      value={selectedElement.style.textShadow || 'none'}
                      onChange={(event) => onPatchStyle({ textShadow: event.target.value })}
                    />
                  </label>
                ) : null}
                <label>
                  {copy.boxShadow}
                  <input
                    value={selectedElement.style.boxShadow || 'none'}
                    onChange={(event) => onPatchStyle({ boxShadow: event.target.value })}
                  />
                </label>
                <div className="segmented-control">
                  <button
                    className={(selectedElement.style.boxShadow || 'none') === 'none' ? 'active' : ''}
                    type="button"
                    onClick={() =>
                      onPatchStyle({
                        boxShadow: 'none',
                        textShadow: selectedElement.type !== 'image' ? 'none' : selectedElement.style.textShadow,
                      })
                    }
                  >
                    {copy.noShadow}
                  </button>
                  <button
                    className={
                      selectedElement.style.boxShadow === '0 18px 40px rgba(0, 0, 0, 0.32)' ? 'active' : ''
                    }
                    type="button"
                    onClick={() =>
                      onPatchStyle({
                        boxShadow: '0 18px 40px rgba(0, 0, 0, 0.32)',
                        textShadow:
                          selectedElement.type !== 'image'
                            ? '0 3px 14px rgba(0, 0, 0, 0.45)'
                            : selectedElement.style.textShadow,
                      })
                    }
                  >
                    {copy.softShadow}
                  </button>
                </div>
              </div>

              <div className="inspector-group">
                <p className="mini-heading">{copy.border}</p>
                <div className="form-grid two-columns">
                  <NumberInput
                    label={copy.borderWidth}
                    value={fieldNumber(selectedElement.style.borderWidth)}
                    min={0}
                    max={24}
                    onChange={(value) => onPatchStyle({ borderWidth: value })}
                  />
                  <NumberInput
                    label={copy.radius}
                    value={fieldNumber(selectedElement.style.borderRadius)}
                    min={0}
                    max={96}
                    onChange={(value) => onPatchStyle({ borderRadius: value })}
                  />
                </div>
                <label>
                  {copy.borderColor}
                  <input
                    type="color"
                    value={hexColor(selectedElement.style.borderColor, '#b88746')}
                    onChange={(event) => onPatchStyle({ borderColor: event.target.value })}
                  />
                </label>
              </div>
            </div>
          ) : null}

          <button className="danger-button inspector-delete" type="button" onClick={onDelete}>
            {copy.deleteElement}
          </button>
        </>
      ) : (
        <div className="empty-panel">
          <p>{copy.selectHint}</p>
        </div>
      )}
    </section>
  );
}
