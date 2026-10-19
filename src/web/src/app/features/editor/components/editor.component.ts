import { Component, DoCheck, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, signal } from "@angular/core";
import { Router } from "@angular/router";

import {
  EditorLayer,
  Layer,
  LayerType,
  Vector2,
} from "../../../shared/types/layer.types";
import {
  LayerStyleSheet,
  getLayerBorderStyle,
  getLayerOpacity,
} from "../../../shared/helpers/layer-style.helpers";
import {
  CANVAS_SIZE,
  DragState,
  ResizeHandle,
  ResizeState,
  createDragState,
  createResizeState,
  getCanvasStyleValue,
  getDraggedPosition,
  getResizedLayer,
} from "./canvas-coordinates";
import { EditorStore } from "./editor.store";
import { HubStore } from "../../../core/store/hub.store";
import { AuthStore } from "../../auth/auth.store";
import {
  HUB_BACKGROUNDS,
  getHubBackground,
} from "../../../shared/types/hub-background.types";
import {
  LayerMenuAction,
  copyLayer,
  getLayerMenuItems as buildLayerMenuItems,
  pasteLayer,
} from "./layer-menu-actions";

@Component({
  selector: "app-editor",
  standalone: false,
  templateUrl: "./editor.component.html",
  styleUrls: ["../styles/editor.styles.css"],
  providers: [EditorStore],
})
export class EditorComponent implements OnInit, DoCheck, OnDestroy {
  @ViewChild('appearanceSection') appearanceSection?: ElementRef<HTMLDetailsElement>;
  @ViewChild('contentSection') contentSection?: ElementRef<HTMLDetailsElement>;
  private dragState: DragState | null = null;
  private resizeState: ResizeState | null = null;
  private copiedLayer: EditorLayer | null = null;
  private scopedStyleSheet = new LayerStyleSheet();

  getCanvasStyleValue = getCanvasStyleValue;

  LayerType = LayerType;
  backgroundOptions = HUB_BACKGROUNDS;
  resizeHandles: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

  editingLayerId = signal<string | null>(null);
  draftLayerName = signal("");
  layerContextMenu = signal<{ layer: EditorLayer; x: number; y: number } | null>(null);
  @ViewChild("layerContextMenuElement") private layerContextMenuElement?: ElementRef<HTMLElement>;
  private layerMenuTrigger: HTMLElement | null = null;
  hasCopiedLayer = signal(false);
  draggedLayerId = signal<string | null>(null);
  dragOverGroupId = signal<string | null>(null);
  dragOverRoot = signal(false);
  selectedPartKey = signal('');
  aiBuilderOpen = signal(false);

  constructor(
    private router: Router,
    private authStore: AuthStore,
    public editorStore: EditorStore,
    public hubStore: HubStore,
  ) {}

  ngOnInit() {
    if (!this.hubStore.selectedHub()) {
      this.router.navigate(["/hubs"]);
    }
  }

  ngDoCheck() {
    this.scopedStyleSheet.update(this.hubStore.selectedHub()?.layers ?? []);
  }

  ngOnDestroy() {
    this.finishCanvasInteraction();
    this.scopedStyleSheet.destroy();
  }

  createLayer(type: LayerType) {
    if (!this.hubStore.selectedHub()) {
      this.router.navigate(["/hubs"]);
      return;
    }

    const layer = this.editorStore.createLayer(type);
    this.selectedPartKey.set('');
    const layerAdded = this.hubStore.addLayer(layer);

    if (!layerAdded) {
      return;
    }

    this.editingLayerId.set(layer.id);
    this.draftLayerName.set(layer.name);
    this.editorStore.selectLayer(layer.id);
    this.closeLayerMenu();
  }

  saveHub() {
    this.hubStore.saveSelectedHub();
  }

  undo() {
    this.finishCanvasInteraction();

    if (this.hubStore.undoSelectedHub()) {
      this.syncSelectionAfterHistoryChange();
    }
  }

  redo() {
    this.finishCanvasInteraction();

    if (this.hubStore.redoSelectedHub()) {
      this.syncSelectionAfterHistoryChange();
    }
  }

  getSelectedBackgroundId() {
    return getHubBackground(this.hubStore.selectedHub()?.layout?.backgroundId)
      .id;
  }

  getCanvasBackground() {
    const background = getHubBackground(
      this.hubStore.selectedHub()?.layout?.backgroundId,
    );

    return background.id === "transparent" ? "transparent" : null;
  }

  getCanvasBackgroundImage() {
    const background = getHubBackground(
      this.hubStore.selectedHub()?.layout?.backgroundId,
    );

    return background.src
      ? `linear-gradient(180deg, rgb(24 11 16 / 18%), rgb(24 11 16 / 24%)), url("${background.src}")`
      : null;
  }

  setBackground(backgroundId: string) {
    this.hubStore.updateSelectedHubBackground(backgroundId);
  }

  updateSelectedLayerPosition(axis: "x" | "y", event: Event) {
    const selectedLayer = this.editorStore.selectedLayer();

    if (!selectedLayer) {
      return;
    }

    const value = getEventNumberValue(event, selectedLayer.position[axis]);

    this.editorStore.moveLayer(selectedLayer.id, {
      ...selectedLayer.position,
      [axis]: value,
    });
  }

  updateSelectedLayerSize(axis: "width" | "height", event: Event) {
    const selectedLayer = this.editorStore.selectedLayer();

    if (!selectedLayer) {
      return;
    }

    this.editorStore.updateLayer(selectedLayer.id, {
      [axis]: Math.max(1, getEventNumberValue(event, selectedLayer[axis])),
    } as Partial<EditorLayer>);
  }

  alignSelectedLayer(alignment: "left" | "center" | "right" | "top" | "middle" | "bottom") {
    const selectedLayer = this.editorStore.selectedLayer();

    if (!selectedLayer) {
      return;
    }

    const position = { ...selectedLayer.position };

    switch (alignment) {
      case "left":
        position.x = selectedLayer.width / 2;
        break;
      case "center":
        position.x = CANVAS_SIZE.width / 2;
        break;
      case "right":
        position.x = CANVAS_SIZE.width - selectedLayer.width / 2;
        break;
      case "top":
        position.y = selectedLayer.height / 2;
        break;
      case "middle":
        position.y = CANVAS_SIZE.height / 2;
        break;
      case "bottom":
        position.y = CANVAS_SIZE.height - selectedLayer.height / 2;
        break;
    }

    this.editorStore.moveLayer(selectedLayer.id, position);
  }

  moveSelectedLayerForward() {
    const selectedLayerId = this.editorStore.selectedLayerId();

    if (selectedLayerId) {
      this.editorStore.moveLayerForward(selectedLayerId);
    }
  }

  moveSelectedLayerBackward() {
    const selectedLayerId = this.editorStore.selectedLayerId();

    if (selectedLayerId) {
      this.editorStore.moveLayerBackward(selectedLayerId);
    }
  }

  getLayerBackground(layer: EditorLayer) {
    return layer.style?.backgroundColor ?? null;
  }

  getLayerColor(layer: EditorLayer) {
    return layer.style?.color ?? null;
  }

  getLayerOpacity(layer: EditorLayer) {
    return getLayerOpacity(layer.style);
  }

  getLayerBorderColor(layer: EditorLayer) {
    return layer.style?.borderColor ?? null;
  }

  getLayerBorderWidth(layer: EditorLayer) {
    return layer.style?.borderWidth ?? null;
  }

  getLayerBorderStyle(layer: EditorLayer) {
    return getLayerBorderStyle(layer.style);
  }

  getLayerBorderRadius(layer: EditorLayer) {
    return layer.style?.borderRadius ?? null;
  }

  getLayerPadding(layer: EditorLayer) {
    return layer.style?.padding ?? null;
  }

  getLayerBoxShadow(layer: EditorLayer) {
    return layer.style?.boxShadow ?? null;
  }

  getLayerTextShadow(layer: EditorLayer) {
    return layer.style?.textShadow ?? null;
  }

  removeSelectedLayer() {
    const selectedLayerId = this.editorStore.selectedLayerId();

    if (!selectedLayerId) {
      return;
    }

    this.removeLayer(selectedLayerId);
  }

  clearLayerSelection() {
    this.editorStore.selectLayer(null);
    this.selectedPartKey.set('');
    this.closeLayerMenu();
  }

  startCanvasPointerDown(event: PointerEvent, canvas: HTMLElement) {
    const layer = this.getTopmostLayerAtPointer(event, canvas);

    if (!layer) {
      this.clearLayerSelection();
      return;
    }

    const target = event.target instanceof Element ? event.target : null;
    const part = target?.closest('[data-component-part]');
    const parentLayer = part?.closest('[data-layer-id]');
    const partKey = parentLayer?.getAttribute('data-layer-id') === layer.id ?
      part?.getAttribute('data-component-part') || '' : '';
    this.selectedPartKey.set(partKey);
    if (partKey) {
      setTimeout(() => {
        if (this.contentSection) this.contentSection.nativeElement.open = false;
        if (this.appearanceSection) {
          this.appearanceSection.nativeElement.open = true;
          this.appearanceSection.nativeElement.scrollIntoView({ block: 'nearest' });
        }
      }, 0);
    }

    this.startDrag(event, layer, canvas);
  }

  getCanvasLayerZIndex(layerIndex: number) {
    const layerCount = this.hubStore.selectedHub()?.layers.length ?? 0;

    return layerCount - layerIndex;
  }

  selectLayerFromPanel(layer: EditorLayer) {
    if (this.editorStore.selectedLayerId() !== layer.id) this.selectedPartKey.set('');
    this.editorStore.selectLayer(layer.id);
    this.closeLayerMenu();
  }

  openLayerMenu(event: MouseEvent, layer: EditorLayer) {
    if (this.isTextEditingTarget(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.showLayerMenu(layer, event.currentTarget as HTMLElement, event.clientX, event.clientY);
  }

  handleLayerRowKeydown(event: KeyboardEvent, layer: EditorLayer) {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      const row = event.currentTarget as HTMLElement;
      const bounds = row.getBoundingClientRect();
      this.showLayerMenu(layer, row, bounds.left + 16, bounds.bottom);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.selectLayerFromPanel(layer);
    }
  }

  private showLayerMenu(layer: EditorLayer, trigger: HTMLElement, x: number, y: number) {
    if (this.editorStore.selectedLayerId() !== layer.id) this.selectedPartKey.set('');
    this.editorStore.selectLayer(layer.id);
    this.layerMenuTrigger = trigger;
    this.layerContextMenu.set({ layer, x, y });

    requestAnimationFrame(() => {
      const menu = this.layerContextMenuElement?.nativeElement;
      const state = this.layerContextMenu();
      if (!menu || !state || state.layer.id !== layer.id) {
        return;
      }

      const bounds = menu.getBoundingClientRect();
      this.layerContextMenu.set({
        ...state,
        x: Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8)),
        y: Math.max(8, Math.min(y, window.innerHeight - bounds.height - 8)),
      });
      menu.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    });
  }

  closeLayerMenu(restoreFocus = false) {
    this.layerContextMenu.set(null);
    if (restoreFocus && this.layerMenuTrigger?.isConnected) {
      this.layerMenuTrigger.focus({ preventScroll: true });
    }
    this.layerMenuTrigger = null;
  }

  @HostListener("document:pointerdown", ["$event"])
  dismissLayerMenu(event: PointerEvent) {
    if (this.layerContextMenu() && !this.layerContextMenuElement?.nativeElement.contains(event.target as Node)) {
      this.closeLayerMenu();
    }
  }

  @HostListener("window:resize")
  dismissLayerMenuOnResize() {
    this.closeLayerMenu();
  }

  handleLayerMenuKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") {
        event.preventDefault();
      }
      event.stopPropagation();
      this.closeLayerMenu(true);
      return;
    }

    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const buttons = Array.from(this.layerContextMenuElement?.nativeElement.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
      : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus({ preventScroll: true });
  }

  toggleLayerVisibility(event: Event, layer: EditorLayer) {
    event.stopPropagation();
    this.editorStore.updateLayer(layer.id, {
      visible: layer.visible === false,
    });
  }

  getLayerPanelRows(): LayerPanelRow[] {
    const layers = this.hubStore.selectedHub()?.layers ?? [];
    const groupIds = new Set(
      layers
        .filter((layer) => layer.type === LayerType.Group)
        .map((layer) => layer.id),
    );
    const childrenByGroupId = new Map<string, EditorLayer[]>();

    for (const layer of layers) {
      if (
        layer.type === LayerType.Group ||
        !layer.groupId ||
        !groupIds.has(layer.groupId)
      ) {
        continue;
      }

      const groupChildren = childrenByGroupId.get(layer.groupId) ?? [];

      groupChildren.push(layer);
      childrenByGroupId.set(layer.groupId, groupChildren);
    }

    return layers.flatMap((layer) => {
      if (
        layer.type !== LayerType.Group &&
        layer.groupId &&
        groupIds.has(layer.groupId)
      ) {
        return [];
      }

      if (layer.type !== LayerType.Group) {
        return [
          {
            layer,
            depth: 0,
            childCount: 0,
          },
        ];
      }

      const children = childrenByGroupId.get(layer.id) ?? [];
      const groupRow: LayerPanelRow = {
        layer,
        depth: 0,
        childCount: children.length,
      };

      if (layer.collapsed) {
        return [groupRow];
      }

      return [
        groupRow,
        ...children.map((child) => ({
          layer: child,
          depth: 1 as const,
          childCount: 0,
        })),
      ];
    });
  }

  getLayerKindLabel(row: LayerPanelRow) {
    if (row.layer.type !== LayerType.Group) {
      return row.layer.type;
    }

    return `${row.childCount} ${row.childCount === 1 ? "layer" : "layers"}`;
  }

  canDragLayerRow(layer: EditorLayer) {
    return layer.type !== LayerType.Group;
  }

  isGroupCollapsed(layer: EditorLayer) {
    return layer.type === LayerType.Group && layer.collapsed;
  }

  toggleGroupCollapsed(event: Event, layer: EditorLayer) {
    event.stopPropagation();
    this.selectedPartKey.set('');
    this.editorStore.selectLayer(layer.id);
    this.closeLayerMenu();
    this.editorStore.toggleGroupCollapsed(layer.id);
  }

  startLayerListDrag(event: DragEvent, layer: EditorLayer) {
    this.closeLayerMenu();
    if (event.target instanceof HTMLElement && event.target.closest("button, input")) {
      event.preventDefault();
      return;
    }
    if (!this.canDragLayerRow(layer)) {
      event.preventDefault();
      return;
    }

    this.draggedLayerId.set(layer.id);
    this.dragOverGroupId.set(null);
    this.dragOverRoot.set(false);
    event.dataTransfer?.setData("text/plain", layer.id);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  }

  handleLayerListDragOver(event: DragEvent) {
    const draggedLayer = this.getDraggedLayer();

    if (!draggedLayer) {
      return;
    }

    event.preventDefault();
    this.dragOverGroupId.set(null);
    this.dragOverRoot.set(true);

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  }

  handleLayerListDragLeave(event: DragEvent) {
    const nextTarget = event.relatedTarget;

    if (
      nextTarget instanceof Node &&
      event.currentTarget instanceof HTMLElement &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }

    this.dragOverRoot.set(false);
  }

  dropLayerOnRoot(event: DragEvent) {
    const draggedLayer = this.getDraggedLayer();

    if (!draggedLayer) {
      return;
    }

    event.preventDefault();
    this.editorStore.setLayerGroup(draggedLayer.id, null);
    this.finishLayerListDrag();
  }

  handleGroupDragOver(event: DragEvent, layer: EditorLayer) {
    if (!this.canDropLayerOnGroup(layer)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.dragOverRoot.set(false);
    this.dragOverGroupId.set(layer.id);

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  }

  handleGroupDragLeave(event: DragEvent, layer: EditorLayer) {
    if (layer.type !== LayerType.Group || this.dragOverGroupId() !== layer.id) {
      return;
    }

    const nextTarget = event.relatedTarget;

    if (
      nextTarget instanceof Node &&
      event.currentTarget instanceof HTMLElement &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }

    this.dragOverGroupId.set(null);
  }

  dropLayerOnGroup(event: DragEvent, layer: EditorLayer) {
    if (!this.canDropLayerOnGroup(layer)) {
      return;
    }

    const draggedLayer = this.getDraggedLayer();

    if (!draggedLayer) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.editorStore.setLayerGroup(draggedLayer.id, layer.id);
    this.finishLayerListDrag();
  }

  finishLayerListDrag() {
    this.draggedLayerId.set(null);
    this.dragOverGroupId.set(null);
    this.dragOverRoot.set(false);
  }

  getLayerMenuItems() {
    return buildLayerMenuItems(this.hasCopiedLayer());
  }

  runLayerMenuAction(event: Event, layer: EditorLayer, action: LayerMenuAction) {
    event.stopPropagation();
    if (this.editorStore.selectedLayerId() !== layer.id) this.selectedPartKey.set('');
    this.editorStore.selectLayer(layer.id);
    this.closeLayerMenu(action !== "rename");

    switch (action) {
      case "rename":
        this.editingLayerId.set(layer.id);
        this.draftLayerName.set(layer.name);
        return;
      case "copy":
        this.copiedLayer = copyLayer(layer);
        this.hasCopiedLayer.set(true);
        return;
      case "paste":
        this.pasteCopiedLayer();
        return;
      case "duplicate":
        this.copiedLayer = copyLayer(layer);
        this.hasCopiedLayer.set(true);
        this.pasteCopiedLayer();
        return;
      case "forward":
        this.editorStore.moveLayerForward(layer.id);
        return;
      case "back":
        this.editorStore.moveLayerBackward(layer.id);
        return;
      case "delete":
        this.removeLayer(layer.id);
        return;
    }
  }

  @HostListener("document:keydown", ["$event"])
  handleHistoryShortcut(event: KeyboardEvent) {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      !(event.ctrlKey || event.metaKey) ||
      this.isNativeUndoTarget(event.target) ||
      !this.hubStore.selectedHub()
    ) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === "z") {
      event.preventDefault();

      if (event.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
    } else if (key === "y" && !event.shiftKey) {
      event.preventDefault();
      this.redo();
    }
  }

  @HostListener("document:keydown", ["$event"])
  deleteSelectedLayer(event: KeyboardEvent) {
    if (event.key !== "Delete" && event.key !== "Backspace") {
      return;
    }

    if (this.isTextEditingTarget(event.target)) {
      return;
    }

    if (!this.editorStore.selectedLayerId()) {
      return;
    }

    event.preventDefault();
    this.removeSelectedLayer();
  }

  logout() {
    this.authStore.logout().subscribe(() => {
      this.hubStore.hubs.set([]);
      this.hubStore.selectedHubId.set(null);
      this.router.navigate(["/login"]);
    });
  }

  commitLayerName(layerId: string) {
    const name = this.draftLayerName().trim();

    if (!name) {
      this.editingLayerId.set(null);
      return;
    }

    this.editorStore.renameLayer(layerId, name);

    this.editingLayerId.set(null);
  }

  closeLayerNameEditor(event: KeyboardEvent) {
    if (event.key !== "Escape") {
      return;
    }

    event.stopPropagation();
    this.editingLayerId.set(null);
    this.draftLayerName.set("");
  }

  startDrag(event: PointerEvent, layer: Layer, canvas: HTMLElement) {
    event.preventDefault();
    event.stopPropagation();

    this.finishCanvasInteraction();
    this.hubStore.beginHistoryGroup();
    this.editorStore.selectLayer(layer.id);
    this.resizeState = null;
    this.dragState = createDragState(
      layer.id,
      layer.position,
      layer,
      event,
      canvas,
    );

    document.addEventListener("pointermove", this.onDragMove);
    document.addEventListener("pointerup", this.stopDrag);
    document.addEventListener("pointercancel", this.stopDrag);
  }

  onDragMove = (event: PointerEvent) => {
    if (!this.dragState) {
      return;
    }

    this.editorStore.moveLayer(
      this.dragState.layerId,
      getDraggedPosition(event, this.dragState),
    );
  };

  startResize(
    event: PointerEvent,
    handle: ResizeHandle,
    layer: Layer,
    canvas: HTMLElement,
  ) {
    event.preventDefault();
    event.stopPropagation();

    this.finishCanvasInteraction();
    this.hubStore.beginHistoryGroup();
    this.editorStore.selectLayer(layer.id);
    this.dragState = null;
    this.resizeState = createResizeState(layer, handle, event, canvas);

    document.addEventListener("pointermove", this.onResizeMove);
    document.addEventListener("pointerup", this.stopResize);
    document.addEventListener("pointercancel", this.stopResize);
  }

  onResizeMove = (event: PointerEvent) => {
    if (!this.resizeState) {
      return;
    }

    this.editorStore.resizeLayer(
      this.resizeState.layerId,
      getResizedLayer(event, this.resizeState),
    );
  };

  stopDrag = () => {
    if (this.dragState) {
      this.hubStore.endHistoryGroup();
    }

    this.dragState = null;

    document.removeEventListener("pointermove", this.onDragMove);
    document.removeEventListener("pointerup", this.stopDrag);
    document.removeEventListener("pointercancel", this.stopDrag);
  };

  stopResize = () => {
    if (this.resizeState) {
      this.hubStore.endHistoryGroup();
    }

    this.resizeState = null;

    document.removeEventListener("pointermove", this.onResizeMove);
    document.removeEventListener("pointerup", this.stopResize);
    document.removeEventListener("pointercancel", this.stopResize);
  };

  @HostListener("window:blur")
  finishCanvasInteraction() {
    this.closeLayerMenu();
    this.stopDrag();
    this.stopResize();
  }

  private syncSelectionAfterHistoryChange() {
    const selectedLayerId = this.editorStore.selectedLayerId();

    if (!this.hubStore.selectedHub()?.layers.some((layer) => layer.id === selectedLayerId)) {
      this.editorStore.selectLayer(null);
      this.selectedPartKey.set('');
    }

    this.editingLayerId.set(null);
    this.draftLayerName.set("");
    this.closeLayerMenu();
    this.finishLayerListDrag();
  }

  private isNativeUndoTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const tagName = target.tagName.toLowerCase();

    return (
      target.isContentEditable ||
      tagName === "textarea" ||
      (tagName === "input" &&
        ["text", "number", "search", "email", "password", "tel", "url"].includes(
          (target as HTMLInputElement).type,
        ))
    );
  }

  private isTextEditingTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const tagName = target.tagName.toLowerCase();

    return (
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "select" ||
      target.isContentEditable
    );
  }

  private getTopmostLayerAtPointer(event: PointerEvent, canvas: HTMLElement) {
    const selectedHub = this.hubStore.selectedHub();
    const pointerPosition = this.getCanvasPointerPosition(event, canvas);

    if (!selectedHub || !pointerPosition) {
      return null;
    }

    return (
      selectedHub.layers.find(
        (layer) =>
          layer.visible && this.isCanvasPointInsideLayer(pointerPosition, layer),
      ) ?? null
    );
  }

  private getCanvasPointerPosition(
    event: PointerEvent,
    canvas: HTMLElement,
  ): Vector2 | null {
    const rect = canvas.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const position = {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_SIZE.width,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_SIZE.height,
    };

    if (
      position.x < 0 ||
      position.x > CANVAS_SIZE.width ||
      position.y < 0 ||
      position.y > CANVAS_SIZE.height
    ) {
      return null;
    }

    return position;
  }

  private isCanvasPointInsideLayer(point: Vector2, layer: Layer) {
    const halfWidth = layer.width / 2;
    const halfHeight = layer.height / 2;

    return (
      point.x >= layer.position.x - halfWidth &&
      point.x <= layer.position.x + halfWidth &&
      point.y >= layer.position.y - halfHeight &&
      point.y <= layer.position.y + halfHeight
    );
  }

  private removeLayer(layerId: string) {
    this.selectedPartKey.set('');
    this.editingLayerId.set(null);
    this.draftLayerName.set("");
    this.finishCanvasInteraction();
    this.editorStore.removeLayer(layerId);

    if (this.layerContextMenu()?.layer.id === layerId) {
      this.closeLayerMenu();
    }
  }

  pasteCopiedLayer() {
    if (!this.copiedLayer) {
      return;
    }

    const layer = pasteLayer(this.copiedLayer);
    const layerAdded = this.hubStore.addLayer(layer);

    if (!layerAdded) {
      return;
    }

    this.editorStore.selectLayer(layer.id);
    this.selectedPartKey.set('');
    this.closeLayerMenu();
  }

  private getDraggedLayer() {
    const draggedLayerId = this.draggedLayerId();

    if (!draggedLayerId) {
      return null;
    }

    return (
      this.hubStore
        .selectedHub()
        ?.layers.find(
          (layer) =>
            layer.id === draggedLayerId && layer.type !== LayerType.Group,
        ) ?? null
    );
  }

  private canDropLayerOnGroup(layer: EditorLayer) {
    return layer.type === LayerType.Group && !!this.getDraggedLayer();
  }
}

type LayerPanelRow = {
  layer: EditorLayer;
  depth: 0 | 1;
  childCount: number;
};

function getEventNumberValue(event: Event, fallback: number) {
  const value = Number((event.target as HTMLInputElement).value);

  return Number.isFinite(value) ? value : fallback;
}
