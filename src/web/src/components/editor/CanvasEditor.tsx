import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { EditorCopy } from '../../i18n/editorText';
import type { HubElement, HubLayout, NormalizedGameState } from '../../types/hub';
import { HubRenderer, type ResizeDirection } from '../HubRenderer';

interface CanvasEditorProps {
  canvasRef: RefObject<HTMLDivElement | null>;
  hub: HubLayout;
  gameData: NormalizedGameState;
  selectedElementId?: string;
  copy: EditorCopy;
  showGrid: boolean;
  snapEnabled: boolean;
  onClearSelection: () => void;
  onSelectElement: (elementId: string) => void;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onDuplicateElement: (elementId: string) => void;
  onDeleteElement: (elementId: string) => void;
  onAdjustLayer: (elementId: string, delta: number) => void;
  onToggleElementLocked: (elementId: string) => void;
  onToggleElementHidden: (elementId: string) => void;
  onStartMove: (event: ReactPointerEvent<HTMLDivElement>, element: HubElement) => void;
  onStartResize: (
    event: ReactPointerEvent<HTMLButtonElement>,
    element: HubElement,
    direction: ResizeDirection,
  ) => void;
}

export function CanvasEditor({
  canvasRef,
  hub,
  gameData,
  selectedElementId,
  copy,
  showGrid,
  snapEnabled,
  onClearSelection,
  onSelectElement,
  onToggleGrid,
  onToggleSnap,
  onDuplicateElement,
  onDeleteElement,
  onAdjustLayer,
  onToggleElementLocked,
  onToggleElementHidden,
  onStartMove,
  onStartResize,
}: CanvasEditorProps) {
  return (
    <section className="canvas-workbench">
      <div className="canvas-toolbar">
        <div>
          <strong>{copy.canvas}</strong>
          <span>{copy.canvasSize}</span>
        </div>
        <div>
          <strong>{gameData.game.phase}</strong>
          <span>{gameData.events.latest}</span>
        </div>
        <div className="canvas-toggles">
          <button className={showGrid ? 'active' : ''} type="button" onClick={onToggleGrid}>
            {copy.grid}
          </button>
          <button className={snapEnabled ? 'active' : ''} type="button" onClick={onToggleSnap}>
            {copy.snap}
          </button>
        </div>
      </div>
      <div
        ref={canvasRef}
        className={`canvas-frame ${showGrid ? 'show-grid' : 'hide-grid'}`}
        onPointerDown={onClearSelection}
      >
        <HubRenderer
          hub={hub}
          gameData={gameData}
          mode="editor"
          selectedElementId={selectedElementId}
          onSelectElement={onSelectElement}
          onDuplicateElement={onDuplicateElement}
          onDeleteElement={onDeleteElement}
          onAdjustLayer={onAdjustLayer}
          onToggleElementLocked={onToggleElementLocked}
          onToggleElementHidden={onToggleElementHidden}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
        />
        {hub.elements.length === 0 ? (
          <div className="empty-canvas">
            <p className="eyebrow">{copy.emptyHub}</p>
            <h2>{copy.emptyHint}</h2>
          </div>
        ) : null}
      </div>
    </section>
  );
}
