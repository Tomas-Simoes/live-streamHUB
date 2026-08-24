import { Component, HostListener, OnInit, signal } from "@angular/core";
import { Router } from "@angular/router";

import {
  EditorLayer,
  Layer,
  LayerType,
  Vector2,
} from "../../../shared/types/layer.types";
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
export class EditorComponent implements OnInit {
  private dragState: DragState | null = null;
  private resizeState: ResizeState | null = null;
  private copiedLayer: EditorLayer | null = null;

  getCanvasStyleValue = getCanvasStyleValue;

  LayerType = LayerType;
  backgroundOptions = HUB_BACKGROUNDS;
  resizeHandles: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

  editingLayerId = signal<string | null>(null);
  draftLayerName = signal("");
  activeLayerMenuId = signal<string | null>(null);
  hasCopiedLayer = signal(false);
  draggedLayerId = signal<string | null>(null);
  dragOverGroupId = signal<string | null>(null);
  dragOverRoot = signal(false);

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

  createLayer(type: LayerType) {
    if (!this.hubStore.selectedHub()) {
      this.router.navigate(["/hubs"]);
      return;
    }

    const layer = this.editorStore.createLayer(type);
    const layerAdded = this.hubStore.addLayer(layer);

    if (!layerAdded) {
      return;
    }

    this.editingLayerId.set(layer.id);
    this.draftLayerName.set(layer.name);
    this.activeLayerMenuId.set(layer.id);
  }

  saveHub() {
    this.hubStore.saveSelectedHub();
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

  removeSelectedLayer() {
    const selectedLayerId = this.editorStore.selectedLayerId();

    if (!selectedLayerId) {
      return;
    }

    this.removeLayer(selectedLayerId);
  }

  clearLayerSelection() {
    this.editorStore.selectLayer(null);
    this.activeLayerMenuId.set(null);
  }

  startCanvasPointerDown(event: PointerEvent, canvas: HTMLElement) {
    const layer = this.getTopmostLayerAtPointer(event, canvas);

    if (!layer) {
      this.clearLayerSelection();
      return;
    }

    this.startDrag(event, layer, canvas);
  }

  getCanvasLayerZIndex(layerIndex: number) {
    const layerCount = this.hubStore.selectedHub()?.layers.length ?? 0;

    return layerCount - layerIndex;
  }

  selectLayerFromPanel(layer: EditorLayer) {
    this.editorStore.selectLayer(layer.id);
    this.activeLayerMenuId.set(layer.id);
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
    this.editorStore.selectLayer(layer.id);
    this.activeLayerMenuId.set(layer.id);
    this.editorStore.toggleGroupCollapsed(layer.id);
  }

  startLayerListDrag(event: DragEvent, layer: EditorLayer) {
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
    this.editorStore.selectLayer(layer.id);
    this.activeLayerMenuId.set(layer.id);

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
      case "delete":
        this.removeLayer(layer.id);
        return;
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

    this.editorStore.selectLayer(layer.id);
    this.dragState = null;
    this.resizeState = createResizeState(layer, handle, event, canvas);

    document.addEventListener("pointermove", this.onResizeMove);
    document.addEventListener("pointerup", this.stopResize);
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
    this.dragState = null;

    document.removeEventListener("pointermove", this.onDragMove);
    document.removeEventListener("pointerup", this.stopDrag);
  };

  stopResize = () => {
    this.resizeState = null;

    document.removeEventListener("pointermove", this.onResizeMove);
    document.removeEventListener("pointerup", this.stopResize);
  };

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
    this.editingLayerId.set(null);
    this.draftLayerName.set("");
    this.dragState = null;
    this.resizeState = null;
    this.editorStore.removeLayer(layerId);

    if (this.activeLayerMenuId() === layerId) {
      this.activeLayerMenuId.set(null);
    }
  }

  private pasteCopiedLayer() {
    if (!this.copiedLayer) {
      return;
    }

    const layer = pasteLayer(this.copiedLayer);
    const layerAdded = this.hubStore.addLayer(layer);

    if (!layerAdded) {
      return;
    }

    this.editorStore.selectLayer(layer.id);
    this.activeLayerMenuId.set(layer.id);
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
