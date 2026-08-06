import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { editorText, type EditorLanguage } from '../i18n/editorText';
import { DATA_BINDINGS, getBindingDefinition } from '../services/dataBindings';
import { useGameDataFeed } from '../services/gameDataFeed';
import { getOverlayUrl, loadHub, saveHub, saveHubLocally } from '../services/hubStorage';
import { createId } from '../services/id';
import { obsBrowserSourceService, type ObsConnectionState } from '../services/obsService';
import type { HubElement, HubLayout } from '../types/hub';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../types/hub';
import { CanvasEditor } from './editor/CanvasEditor';
import { AssetPanel } from './editor/AssetPanel';
import { EditorStatusBar } from './editor/EditorStatusBar';
import { RightRail } from './editor/RightRail';
import { TopBar } from './editor/TopBar';
import type { ResizeDirection } from './HubRenderer';
import { ObsConnectModal } from './ObsConnectModal';

type Interaction =
  | {
      type: 'move';
      elementId: string;
      startPoint: { x: number; y: number };
      startElement: HubElement;
    }
  | {
      type: 'resize';
      elementId: string;
      direction: ResizeDirection;
      startPoint: { x: number; y: number };
      startElement: HubElement;
    };

const GRID_SIZE = 10;
const MIN_ELEMENT_SIZE = 36;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function snapValue(value: number, enabled: boolean): number {
  return enabled ? Math.round(value / GRID_SIZE) * GRID_SIZE : value;
}

function createBaseElement(type: HubElement['type'], zIndex: number): HubElement {
  const isText = type === 'text';
  const isImage = type === 'image';

  return {
    id: createId(type),
    name: type === 'data-widget' ? 'Data Widget' : isImage ? 'Image' : 'Text',
    type,
    x: isText ? 700 : 760,
    y: isText ? 420 : 450,
    width: isText ? 520 : 300,
    height: isText ? 112 : 170,
    rotation: 0,
    zIndex,
    content: {},
    style: {
      color: isImage ? '#ffffff' : '#f4e8ce',
      backgroundColor: isText || isImage ? 'transparent' : 'rgba(36, 26, 23, 0.84)',
      borderColor: '#b88746',
      borderWidth: isText || isImage ? 0 : 1,
      borderRadius: isText ? 0 : 8,
      objectFit: 'cover',
      fontFamily: isText ? 'Georgia, "Times New Roman", serif' : 'Inter, Arial, sans-serif',
      fontSize: isText ? 58 : 28,
      fontWeight: isText ? 900 : 800,
      textAlign: 'center',
      opacity: 1,
      padding: isText || isImage ? 0 : 12,
      textTransform: 'none',
      lineHeight: 1.08,
      letterSpacing: 0,
      textShadow: isImage ? undefined : 'none',
      boxShadow: 'none',
    },
  };
}

function getNextZIndex(hub: HubLayout): number {
  return hub.elements.reduce((max, element) => Math.max(max, element.zIndex), 0) + 1;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches('input, textarea, select, [contenteditable="true"]');
}

interface HubEditorProps {
  hubId?: string;
}

export function HubEditor({ hubId }: HubEditorProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const gameData = useGameDataFeed();

  const [appName, setAppName] = useState<'Marquee' | 'Live Hub'>('Marquee');
  const [language, setLanguage] = useState<EditorLanguage>(() => {
    const stored = window.localStorage.getItem('live-streamhub.language');
    return stored === 'pt' ? 'pt' : 'en';
  });
  const copy = editorText[language];

  const [hub, setHub] = useState<HubLayout | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | undefined>();
  const [imageUrl, setImageUrl] = useState('/cristiano.jpg');
  const [loadError, setLoadError] = useState<string | undefined>();
  const [saveStatus, setSaveStatus] = useState('Not saved yet');
  const [isSaving, setIsSaving] = useState(false);
  const [isObsOpen, setIsObsOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [obsStatus, setObsStatus] = useState<ObsConnectionState>(obsBrowserSourceService.getState());

  useEffect(() => {
    let cancelled = false;

    loadHub(hubId)
      .then((loadedHub) => {
        if (!cancelled) {
          setHub(loadedHub);
          setSaveStatus(editorText.en.loaded);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load Hub');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hubId]);

  const selectedElement = useMemo(
    () => hub?.elements.find((element) => element.id === selectedElementId),
    [hub, selectedElementId],
  );

  const groupedBindings = useMemo(() => {
    return DATA_BINDINGS.reduce<Record<string, typeof DATA_BINDINGS>>((groups, binding) => {
      groups[binding.group] = groups[binding.group] || [];
      groups[binding.group].push(binding);
      return groups;
    }, {});
  }, []);

  const overlayUrl = hub ? getOverlayUrl(hub.id) : '';
  const sortedLayers = useMemo(
    () => hub?.elements.slice().sort((a, b) => b.zIndex - a.zIndex) ?? [],
    [hub?.elements],
  );
  const recentElements = useMemo(() => hub?.elements.slice(-5).reverse() ?? [], [hub?.elements]);

  const getCanvasPoint = (event: PointerEvent | ReactPointerEvent): { x: number; y: number } => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    };
  };

  const updateHub = (updater: (current: HubLayout) => HubLayout) => {
    setHub((current) => {
      if (!current) return current;
      const nextHub = updater(current);
      const savedHub = saveHubLocally({
        ...nextHub,
        updatedAt: new Date().toISOString(),
      });
      setSaveStatus(copy.localDraft);
      return savedHub;
    });
  };

  const patchElement = (elementId: string, patch: Partial<HubElement>) => {
    updateHub((current) => ({
      ...current,
      elements: current.elements.map((element) =>
        element.id === elementId ? { ...element, ...patch } : element,
      ),
    }));
  };

  const patchSelectedElement = (patch: Partial<HubElement>) => {
    if (!selectedElement) return;
    patchElement(selectedElement.id, patch);
  };

  const patchSelectedStyle = (patch: Partial<HubElement['style']>) => {
    if (!selectedElement) return;
    patchElement(selectedElement.id, {
      style: {
        ...selectedElement.style,
        ...patch,
      },
    });
  };

  const patchSelectedContent = (patch: Partial<HubElement['content']>) => {
    if (!selectedElement) return;
    patchElement(selectedElement.id, {
      content: {
        ...selectedElement.content,
        ...patch,
      },
    });
  };

  const addElement = (element: HubElement) => {
    updateHub((current) => ({
      ...current,
      elements: [...current.elements, element],
    }));
    setSelectedElementId(element.id);
  };

  const addElements = (elements: HubElement[]) => {
    if (elements.length === 0) return;
    updateHub((current) => ({
      ...current,
      elements: [...current.elements, ...elements],
    }));
    setSelectedElementId(elements[elements.length - 1].id);
  };

  const addText = () => {
    if (!hub) return;
    const element = createBaseElement('text', getNextZIndex(hub));
    addElement({
      ...element,
      name: 'Headline',
      content: { text: 'Grand Finals' },
    });
  };

  const addImage = (src = imageUrl) => {
    if (!hub) return;
    const element = createBaseElement('image', getNextZIndex(hub));
    addElement({
      ...element,
      name: 'Image',
      width: 340,
      height: 190,
      content: { src: src || '/cristiano.jpg' },
    });
  };

  const addWidget = (bindingKey: string) => {
    if (!hub) return;
    const binding = getBindingDefinition(bindingKey);
    const element = createBaseElement('data-widget', getNextZIndex(hub));

    addElement({
      ...element,
      name: binding?.label || 'Data Widget',
      width: binding?.defaultSize.width || element.width,
      height: binding?.defaultSize.height || element.height,
      dataBinding: bindingKey,
      content: { label: binding?.label.toUpperCase(), showLabel: false },
    });
  };

  const addScoreboard = () => {
    if (!hub) return;
    const baseZ = getNextZIndex(hub);
    const blue = createBaseElement('data-widget', baseZ);
    const clock = createBaseElement('data-widget', baseZ + 1);
    const red = createBaseElement('data-widget', baseZ + 2);

    addElements([
      {
        ...blue,
        id: createId('blue-scorebug'),
        name: 'Blue Kills',
        x: 690,
        y: 38,
        width: 190,
        height: 76,
        dataBinding: 'blueTeam.kills',
        content: { label: 'BLUE', showLabel: false },
        style: {
          ...blue.style,
          color: '#dbeafe',
          backgroundColor: 'rgba(18, 50, 82, 0.88)',
          borderWidth: 1,
          borderRadius: 8,
        },
      },
      {
        ...clock,
        id: createId('clock-scorebug'),
        name: 'Game Time',
        x: 880,
        y: 30,
        width: 160,
        height: 92,
        dataBinding: 'game.time',
        content: { label: 'TIME', showLabel: false },
        style: {
          ...clock.style,
          backgroundColor: 'rgba(36, 26, 23, 0.9)',
          borderWidth: 1,
          borderRadius: 8,
        },
      },
      {
        ...red,
        id: createId('red-scorebug'),
        name: 'Red Kills',
        x: 1040,
        y: 38,
        width: 190,
        height: 76,
        dataBinding: 'redTeam.kills',
        content: { label: 'RED', showLabel: false },
        style: {
          ...red.style,
          color: '#fee2e2',
          backgroundColor: 'rgba(98, 26, 42, 0.9)',
          borderWidth: 1,
          borderRadius: 8,
        },
      },
    ]);
  };

  const addLowerThird = () => {
    if (!hub) return;
    const element = createBaseElement('data-widget', getNextZIndex(hub));
    addElement({
      ...element,
      name: 'Current Event',
      x: 560,
      y: 920,
      width: 800,
      height: 86,
      dataBinding: 'currentEvent',
      content: { label: 'LIVE EVENT', showLabel: false },
      style: {
        ...element.style,
        color: '#f4e8ce',
        backgroundColor: 'rgba(36, 26, 23, 0.86)',
        borderColor: '#b88746',
        borderWidth: 1,
        borderRadius: 8,
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 30,
      },
    });
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') addImage(reader.result);
    });
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleSave = async () => {
    if (!hub) return;
    setIsSaving(true);
    const result = await saveHub(hub);
    setHub(result.hub);
    setSaveStatus(result.message);
    setIsSaving(false);
  };

  const openPreview = () => {
    if (!hub) return;
    window.open(getOverlayUrl(hub.id), '_blank', 'noopener,noreferrer');
  };

  const startMove = (event: ReactPointerEvent<HTMLDivElement>, element: HubElement) => {
    interactionRef.current = {
      type: 'move',
      elementId: element.id,
      startPoint: getCanvasPoint(event),
      startElement: element,
    };
  };

  const startResize = (
    event: ReactPointerEvent<HTMLButtonElement>,
    element: HubElement,
    direction: ResizeDirection,
  ) => {
    interactionRef.current = {
      type: 'resize',
      elementId: element.id,
      direction,
      startPoint: getCanvasPoint(event),
      startElement: element,
    };
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction) return;

      const point = getCanvasPoint(event);
      const deltaX = point.x - interaction.startPoint.x;
      const deltaY = point.y - interaction.startPoint.y;
      const start = interaction.startElement;

      if (interaction.type === 'move') {
        patchElement(interaction.elementId, {
          x: clamp(snapValue(start.x + deltaX, snapEnabled), 0, CANVAS_WIDTH - start.width),
          y: clamp(snapValue(start.y + deltaY, snapEnabled), 0, CANVAS_HEIGHT - start.height),
        });
        return;
      }

      const growsEast = interaction.direction.includes('e');
      const growsSouth = interaction.direction.includes('s');
      const growsWest = interaction.direction.includes('w');
      const growsNorth = interaction.direction.includes('n');

      let nextX = start.x;
      let nextY = start.y;
      let nextWidth = start.width;
      let nextHeight = start.height;

      if (growsEast) {
        nextWidth = clamp(snapValue(start.width + deltaX, snapEnabled), MIN_ELEMENT_SIZE, CANVAS_WIDTH - start.x);
      }
      if (growsSouth) {
        nextHeight = clamp(snapValue(start.height + deltaY, snapEnabled), MIN_ELEMENT_SIZE, CANVAS_HEIGHT - start.y);
      }
      if (growsWest) {
        nextX = clamp(snapValue(start.x + deltaX, snapEnabled), 0, start.x + start.width - MIN_ELEMENT_SIZE);
        nextWidth = start.width + (start.x - nextX);
      }
      if (growsNorth) {
        nextY = clamp(snapValue(start.y + deltaY, snapEnabled), 0, start.y + start.height - MIN_ELEMENT_SIZE);
        nextHeight = start.height + (start.y - nextY);
      }

      patchElement(interaction.elementId, {
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
      });
    };

    const handlePointerUp = () => {
      interactionRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  });

  const deleteElement = (elementId: string) => {
    updateHub((current) => ({
      ...current,
      elements: current.elements.filter((element) => element.id !== elementId),
    }));
    if (selectedElementId === elementId) setSelectedElementId(undefined);
  };

  const removeSelectedElement = () => {
    if (!selectedElement) return;
    deleteElement(selectedElement.id);
  };

  const duplicateElement = (elementId: string) => {
    const element = hub?.elements.find((item) => item.id === elementId);
    if (!element || !hub) return;

    const duplicate: HubElement = {
      ...element,
      id: createId(element.type),
      name: `${element.name} Copy`,
      x: clamp(element.x + 32, 0, CANVAS_WIDTH - element.width),
      y: clamp(element.y + 32, 0, CANVAS_HEIGHT - element.height),
      zIndex: getNextZIndex(hub),
      locked: false,
      hidden: false,
      content: { ...element.content },
      style: { ...element.style },
    };

    addElement(duplicate);
  };

  const toggleElementLocked = (elementId: string) => {
    const element = hub?.elements.find((item) => item.id === elementId);
    if (!element) return;
    patchElement(elementId, { locked: !element.locked });
  };

  const toggleElementHidden = (elementId: string) => {
    const element = hub?.elements.find((item) => item.id === elementId);
    if (!element) return;
    patchElement(elementId, { hidden: !element.hidden });
  };

  const adjustLayer = (elementId: string, delta: number) => {
    const element = hub?.elements.find((item) => item.id === elementId);
    if (!element) return;
    patchElement(elementId, { zIndex: Math.max(1, element.zIndex + delta) });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedElement || selectedElement.locked || isTypingTarget(event.target)) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteElement(selectedElement.id);
        return;
      }

      const keyDelta: Record<string, { x: number; y: number }> = {
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
      };
      const delta = keyDelta[event.key];
      if (!delta) return;

      event.preventDefault();
      const step = event.shiftKey ? 50 : snapEnabled ? GRID_SIZE : 1;
      patchElement(selectedElement.id, {
        x: clamp(snapValue(selectedElement.x + delta.x * step, snapEnabled), 0, CANVAS_WIDTH - selectedElement.width),
        y: clamp(snapValue(selectedElement.y + delta.y * step, snapEnabled), 0, CANVAS_HEIGHT - selectedElement.height),
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (loadError) {
    return (
      <main className="editor-shell centered-state">
        <section className="state-panel">
          <p className="eyebrow">Error</p>
          <h1>{copy.errorTitle}</h1>
          <p>{loadError}</p>
        </section>
      </main>
    );
  }

  if (!hub) {
    return (
      <main className="editor-shell centered-state">
        <section className="state-panel">
          <p className="eyebrow">Loading</p>
          <h1>{copy.loadingTitle}</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="editor-shell">
      <TopBar
        appName={appName}
        hubName={hub.hubName}
        dataConnected={gameData.connected}
        obsStatus={obsStatus}
        saveStatus={saveStatus}
        isSaving={isSaving}
        language={language}
        copy={copy}
        onToggleAppName={() => setAppName((current) => (current === 'Marquee' ? 'Live Hub' : 'Marquee'))}
        onHubNameChange={(hubName) => updateHub((current) => ({ ...current, hubName }))}
        onLanguageChange={(nextLanguage) => {
          setLanguage(nextLanguage);
          window.localStorage.setItem('live-streamhub.language', nextLanguage);
        }}
        onSave={handleSave}
        onPreview={openPreview}
        onConnectObs={() => setIsObsOpen(true)}
      />

      <AssetPanel
        imageUrl={imageUrl}
        groupedBindings={groupedBindings}
        recentElements={recentElements}
        copy={copy}
        onImageUrlChange={setImageUrl}
        onAddText={addText}
        onAddImage={() => addImage()}
        onUploadImage={handleImageUpload}
        onAddWidget={addWidget}
        onAddScoreboard={addScoreboard}
        onAddLowerThird={addLowerThird}
        onSelectRecent={setSelectedElementId}
      />

      <CanvasEditor
        canvasRef={canvasRef}
        hub={hub}
        gameData={gameData}
        selectedElementId={selectedElementId}
        copy={copy}
        showGrid={showGrid}
        snapEnabled={snapEnabled}
        onClearSelection={() => setSelectedElementId(undefined)}
        onSelectElement={setSelectedElementId}
        onToggleGrid={() => setShowGrid((current) => !current)}
        onToggleSnap={() => setSnapEnabled((current) => !current)}
        onDuplicateElement={duplicateElement}
        onDeleteElement={deleteElement}
        onAdjustLayer={adjustLayer}
        onToggleElementLocked={toggleElementLocked}
        onToggleElementHidden={toggleElementHidden}
        onStartMove={startMove}
        onStartResize={startResize}
      />

      <RightRail
        selectedElement={selectedElement}
        layers={sortedLayers}
        selectedElementId={selectedElementId}
        copy={copy}
        onPatchElement={patchSelectedElement}
        onPatchStyle={patchSelectedStyle}
        onPatchContent={patchSelectedContent}
        onDelete={removeSelectedElement}
        onSelectElement={setSelectedElementId}
        onAdjustLayer={adjustLayer}
        onDuplicateElement={duplicateElement}
        onToggleElementLocked={toggleElementLocked}
        onToggleElementHidden={toggleElementHidden}
        onDeleteElement={deleteElement}
      />

      <EditorStatusBar dataConnected={gameData.connected} overlayUrl={overlayUrl} copy={copy} />

      {isObsOpen ? (
        <ObsConnectModal
          overlayUrl={overlayUrl}
          onClose={() => setIsObsOpen(false)}
          onStatusChange={setObsStatus}
        />
      ) : null}
    </main>
  );
}
