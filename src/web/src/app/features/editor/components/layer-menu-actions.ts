import { EditorLayer } from "../../../shared/types/layer.types";

export type LayerMenuAction =
  | "rename"
  | "copy"
  | "paste"
  | "duplicate"
  | "forward"
  | "back"
  | "delete";

export type LayerMenuItem = {
  action: LayerMenuAction;
  label: string;
  disabled: boolean;
};

const PASTED_LAYER_OFFSET = 24;

export function getLayerMenuItems(hasCopiedLayer: boolean): LayerMenuItem[] {
  return [
    { action: "rename", label: "Rename", disabled: false },
    { action: "copy", label: "Copy", disabled: false },
    { action: "paste", label: "Paste", disabled: !hasCopiedLayer },
    { action: "duplicate", label: "Duplicate", disabled: false },
    { action: "forward", label: "Forward", disabled: false },
    { action: "back", label: "Back", disabled: false },
    { action: "delete", label: "Delete", disabled: false },
  ];
}

export function copyLayer(layer: EditorLayer): EditorLayer {
  return cloneLayer(layer);
}

export function pasteLayer(
  copiedLayer: EditorLayer,
  createId: () => string = () => crypto.randomUUID(),
): EditorLayer {
  const layer = cloneLayer(copiedLayer);

  return {
    ...layer,
    id: createId(),
    name: getCopiedLayerName(layer.name),
    position: {
      x: layer.position.x + PASTED_LAYER_OFFSET,
      y: layer.position.y + PASTED_LAYER_OFFSET,
    },
  } as EditorLayer;
}

function cloneLayer(layer: EditorLayer): EditorLayer {
  return structuredClone(layer) as EditorLayer;
}

function getCopiedLayerName(name: string) {
  const trimmedName = name.trim();

  return `${trimmedName || "Layer"} copy`;
}
