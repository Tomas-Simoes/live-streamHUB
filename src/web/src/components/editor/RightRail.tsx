import { useState } from 'react';
import type { EditorCopy } from '../../i18n/editorText';
import type { HubElement } from '../../types/hub';
import { LayersPanel } from './LayersPanel';
import { PropertiesPanel } from './PropertiesPanel';

interface RightRailProps {
  selectedElement?: HubElement;
  layers: HubElement[];
  selectedElementId?: string;
  copy: EditorCopy;
  onPatchElement: (patch: Partial<HubElement>) => void;
  onPatchStyle: (patch: Partial<HubElement['style']>) => void;
  onPatchContent: (patch: Partial<HubElement['content']>) => void;
  onDelete: () => void;
  onSelectElement: (elementId: string) => void;
  onAdjustLayer: (elementId: string, delta: number) => void;
  onDuplicateElement: (elementId: string) => void;
  onToggleElementLocked: (elementId: string) => void;
  onToggleElementHidden: (elementId: string) => void;
  onDeleteElement: (elementId: string) => void;
}

type RailTab = 'properties' | 'layers';

export function RightRail({
  selectedElement,
  layers,
  selectedElementId,
  copy,
  onPatchElement,
  onPatchStyle,
  onPatchContent,
  onDelete,
  onSelectElement,
  onAdjustLayer,
  onDuplicateElement,
  onToggleElementLocked,
  onToggleElementHidden,
  onDeleteElement,
}: RightRailProps) {
  const [activeTab, setActiveTab] = useState<RailTab>('properties');

  return (
    <aside className="right-sidebar">
      <div className="sidebar-tabs rail-tabs" aria-label="Editor side panel">
        <button
          className={activeTab === 'properties' ? 'active' : ''}
          type="button"
          onClick={() => setActiveTab('properties')}
        >
          {copy.inspector}
        </button>
        <button
          className={activeTab === 'layers' ? 'active' : ''}
          type="button"
          onClick={() => setActiveTab('layers')}
        >
          {copy.layers}
        </button>
      </div>

      <div className="sidebar-panel">
        {activeTab === 'properties' ? (
          <PropertiesPanel
            selectedElement={selectedElement}
            copy={copy}
            onPatchElement={onPatchElement}
            onPatchStyle={onPatchStyle}
            onPatchContent={onPatchContent}
            onDelete={onDelete}
          />
        ) : null}

        {activeTab === 'layers' ? (
          <LayersPanel
            layers={layers}
            selectedElementId={selectedElementId}
            copy={copy}
            onSelectElement={onSelectElement}
            onAdjustLayer={onAdjustLayer}
            onDuplicate={onDuplicateElement}
            onToggleLocked={onToggleElementLocked}
            onToggleHidden={onToggleElementHidden}
            onDelete={onDeleteElement}
          />
        ) : null}
      </div>
    </aside>
  );
}
