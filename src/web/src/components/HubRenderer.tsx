import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { getBindingDefinition, formatBindingValue, readBindingValue } from '../services/dataBindings';
import type { HubElement, HubLayout, NormalizedGameState } from '../types/hub';

type ResizeDirection = 'nw' | 'ne' | 'sw' | 'se';

interface HubRendererProps {
  hub: HubLayout;
  gameData: NormalizedGameState;
  mode: 'editor' | 'overlay';
  selectedElementId?: string;
  onSelectElement?: (elementId: string) => void;
  onDuplicateElement?: (elementId: string) => void;
  onDeleteElement?: (elementId: string) => void;
  onAdjustLayer?: (elementId: string, delta: number) => void;
  onToggleElementLocked?: (elementId: string) => void;
  onToggleElementHidden?: (elementId: string) => void;
  onStartMove?: (event: ReactPointerEvent<HTMLDivElement>, element: HubElement) => void;
  onStartResize?: (
    event: ReactPointerEvent<HTMLButtonElement>,
    element: HubElement,
    direction: ResizeDirection,
  ) => void;
}

function buildElementStyle(element: HubElement, hub: HubLayout): CSSProperties {
  const style = element.style;
  const borderWidth = style.borderWidth ?? 0;

  return {
    left: `${(element.x / hub.canvas.width) * 100}%`,
    top: `${(element.y / hub.canvas.height) * 100}%`,
    width: `${(element.width / hub.canvas.width) * 100}%`,
    height: `${(element.height / hub.canvas.height) * 100}%`,
    zIndex: element.zIndex,
    transform: `rotate(${element.rotation ?? 0}deg)`,
    color: style.color,
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    borderStyle: borderWidth > 0 ? 'solid' : undefined,
    borderWidth,
    borderRadius: style.borderRadius,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    textAlign: style.textAlign,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    opacity: style.opacity ?? 1,
    padding: style.padding,
    textTransform: style.textTransform,
    textShadow: style.textShadow,
    boxShadow: style.boxShadow,
  };
}

function renderElementContent(element: HubElement, gameData: NormalizedGameState) {
  if (element.type === 'image') {
    return (
      <img
        className="hub-renderer-image"
        src={element.content.src}
        alt={element.name}
        style={{ objectFit: element.style.objectFit ?? 'cover' }}
        draggable={false}
      />
    );
  }

  if (element.type === 'data-widget') {
    const binding = getBindingDefinition(element.dataBinding);
    const value = formatBindingValue(readBindingValue(gameData, element.dataBinding), binding);

    return (
      <div className="hub-widget-content">
        {element.content.showLabel && element.content.label ? (
          <span className="hub-widget-label">{element.content.label}</span>
        ) : null}
        <span className="hub-widget-value">
          {element.content.prefix}
          {value}
          {element.content.suffix}
        </span>
      </div>
    );
  }

  return <span className="hub-text-content">{element.content.text}</span>;
}

export function HubRenderer({
  hub,
  gameData,
  mode,
  selectedElementId,
  onSelectElement,
  onDuplicateElement,
  onDeleteElement,
  onAdjustLayer,
  onToggleElementLocked,
  onToggleElementHidden,
  onStartMove,
  onStartResize,
}: HubRendererProps) {
  const visibleElements = hub.elements
    .filter((element) => !element.hidden)
    .slice()
    .sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className={`hub-renderer hub-renderer-${mode}`} style={{ aspectRatio: '16 / 9' }}>
      {visibleElements.map((element) => {
        const isSelected = selectedElementId === element.id;
        const className = [
          'hub-element',
          `hub-element-${element.type}`,
          mode === 'editor' ? 'hub-element-editable' : '',
          isSelected ? 'is-selected' : '',
          element.locked ? 'is-locked' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div
            key={element.id}
            className={className}
            style={buildElementStyle(element, hub)}
            onPointerDown={(event) => {
              if (mode !== 'editor') return;
              event.stopPropagation();
              onSelectElement?.(element.id);
              if (element.locked) return;
              onStartMove?.(event, element);
            }}
          >
            {renderElementContent(element, gameData)}
            {mode === 'editor' && isSelected ? (
              <>
                <div className="selection-toolbar" onPointerDown={(event) => event.stopPropagation()}>
                  <span className="selection-readout">
                    {Math.round(element.x)}, {Math.round(element.y)} / {Math.round(element.width)} x{' '}
                    {Math.round(element.height)}
                  </span>
                  <button type="button" onClick={() => onDuplicateElement?.(element.id)}>
                    Copy
                  </button>
                  <button type="button" onClick={() => onAdjustLayer?.(element.id, 1)}>
                    Up
                  </button>
                  <button type="button" onClick={() => onAdjustLayer?.(element.id, -1)}>
                    Down
                  </button>
                  <button type="button" onClick={() => onToggleElementLocked?.(element.id)}>
                    {element.locked ? 'Unlock' : 'Lock'}
                  </button>
                  <button type="button" onClick={() => onToggleElementHidden?.(element.id)}>
                    Hide
                  </button>
                  <button className="selection-danger" type="button" onClick={() => onDeleteElement?.(element.id)}>
                    Del
                  </button>
                </div>
                {!element.locked
                  ? (['nw', 'ne', 'sw', 'se'] as ResizeDirection[]).map((direction) => (
                      <button
                        key={direction}
                        className={`resize-handle resize-handle-${direction}`}
                        aria-label={`Resize ${direction}`}
                        type="button"
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          onStartResize?.(event, element, direction);
                        }}
                      />
                    ))
                  : null}
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export type { ResizeDirection };
