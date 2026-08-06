import type { EditorCopy } from '../../i18n/editorText';
import type { HubElement } from '../../types/hub';

interface LayersPanelProps {
  layers: HubElement[];
  selectedElementId?: string;
  copy: EditorCopy;
  onSelectElement: (elementId: string) => void;
  onAdjustLayer: (elementId: string, delta: number) => void;
  onDuplicate: (elementId: string) => void;
  onToggleLocked: (elementId: string) => void;
  onToggleHidden: (elementId: string) => void;
  onDelete: (elementId: string) => void;
}

export function LayersPanel({
  layers,
  selectedElementId,
  copy,
  onSelectElement,
  onAdjustLayer,
  onDuplicate,
  onToggleLocked,
  onToggleHidden,
  onDelete,
}: LayersPanelProps) {
  return (
    <section className="tool-section layers-panel">
      <div className="section-heading">
        <p className="eyebrow">{copy.stack}</p>
        <h2>{copy.layers}</h2>
      </div>
      {layers.length === 0 ? (
        <div className="empty-panel">
          <p>{copy.noLayers}</p>
        </div>
      ) : (
        layers.map((element) => (
          <div
            className={[
              'layer-row',
              selectedElementId === element.id ? 'active' : '',
              element.hidden ? 'is-hidden' : '',
              element.locked ? 'is-locked' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            key={element.id}
          >
            <button type="button" onClick={() => onSelectElement(element.id)}>
              <span>{element.name}</span>
              <small>
                {element.type}
                {element.hidden ? ` / ${copy.hide}` : ''}
                {element.locked ? ` / ${copy.lock}` : ''}
              </small>
            </button>
            <div className="layer-actions">
              <button type="button" onClick={() => onAdjustLayer(element.id, 1)} aria-label={copy.moveUp} title={copy.moveUp}>
                {copy.moveUp}
              </button>
              <button
                type="button"
                onClick={() => onAdjustLayer(element.id, -1)}
                aria-label={copy.moveDown}
                title={copy.moveDown}
              >
                {copy.moveDown}
              </button>
              <button type="button" onClick={() => onDuplicate(element.id)} aria-label={copy.duplicate} title={copy.duplicate}>
                +
              </button>
              <button
                type="button"
                onClick={() => onToggleHidden(element.id)}
                aria-label={element.hidden ? copy.show : copy.hide}
                title={element.hidden ? copy.show : copy.hide}
              >
                {element.hidden ? copy.show : copy.hide}
              </button>
              <button
                type="button"
                onClick={() => onToggleLocked(element.id)}
                aria-label={element.locked ? copy.unlock : copy.lock}
                title={element.locked ? copy.unlock : copy.lock}
              >
                {element.locked ? copy.unlock : copy.lock}
              </button>
              <button
                className="layer-danger"
                type="button"
                onClick={() => onDelete(element.id)}
                aria-label={copy.deleteElement}
                title={copy.deleteElement}
              >
                x
              </button>
            </div>
          </div>
        ))
      )}
    </section>
  );
}
