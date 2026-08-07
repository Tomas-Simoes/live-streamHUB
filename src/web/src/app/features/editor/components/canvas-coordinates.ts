import { Vector2 } from '../../../shared/types/layer.types';

export const CANVAS_SIZE = {
  width: 1920,
  height: 1080,
} as const;

export type DragState = {
  layerId: string;
  startPointerX: number;
  startPointerY: number;
  startLayerX: number;
  startLayerY: number;
  layerWidth: number;
  layerHeight: number;
  canvasWidth: number;
  canvasHeight: number;
};

export type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export type ResizeState = {
  layerId: string;
  handle: ResizeHandle;
  startPointerX: number;
  startPointerY: number;
  startLeft: number;
  startRight: number;
  startTop: number;
  startBottom: number;
  canvasWidth: number;
  canvasHeight: number;
};

export type LayerResize = {
  position: Vector2;
  width: number;
  height: number;
};

const MIN_LAYER_SIZE = 24;
const MAX_AUTO_FIT_RATIO = 0.75;

export function createDragState(
  layerId: string,
  layerPosition: Vector2,
  layerSize: { width: number; height: number },
  event: PointerEvent,
  canvas: HTMLElement,
): DragState {
  const rect = canvas.getBoundingClientRect();

  return {
    layerId,
    startPointerX: event.clientX,
    startPointerY: event.clientY,
    startLayerX: layerPosition.x,
    startLayerY: layerPosition.y,
    layerWidth: layerSize.width,
    layerHeight: layerSize.height,
    canvasWidth: rect.width,
    canvasHeight: rect.height,
  };
}

export function createResizeState(
  layer: { id: string; position: Vector2; width: number; height: number },
  handle: ResizeHandle,
  event: PointerEvent,
  canvas: HTMLElement,
): ResizeState {
  const rect = canvas.getBoundingClientRect();

  return {
    layerId: layer.id,
    handle,
    startPointerX: event.clientX,
    startPointerY: event.clientY,
    startLeft: layer.position.x - layer.width / 2,
    startRight: layer.position.x + layer.width / 2,
    startTop: layer.position.y - layer.height / 2,
    startBottom: layer.position.y + layer.height / 2,
    canvasWidth: rect.width,
    canvasHeight: rect.height,
  };
}

export function getDraggedPosition(event: PointerEvent, dragState: DragState): Vector2 {
  const delta = getCanvasDelta(event, dragState);
  const position = clampLayerCenter({
    x: dragState.startLayerX + delta.x,
    y: dragState.startLayerY + delta.y,
  }, dragState.layerWidth, dragState.layerHeight);

  return roundVector(position);
}

export function getResizedLayer(event: PointerEvent, resizeState: ResizeState): LayerResize {
  const delta = getCanvasDelta(event, resizeState);
  let left = resizeState.startLeft;
  let right = resizeState.startRight;
  let top = resizeState.startTop;
  let bottom = resizeState.startBottom;

  if (resizeState.handle.includes('w')) {
    left += delta.x;
  }

  if (resizeState.handle.includes('e')) {
    right += delta.x;
  }

  if (resizeState.handle.includes('n')) {
    top += delta.y;
  }

  if (resizeState.handle.includes('s')) {
    bottom += delta.y;
  }

  if (resizeState.handle.includes('w')) {
    left = clamp(left, 0, right - MIN_LAYER_SIZE);
  }

  if (resizeState.handle.includes('e')) {
    right = clamp(right, left + MIN_LAYER_SIZE, CANVAS_SIZE.width);
  }

  if (resizeState.handle.includes('n')) {
    top = clamp(top, 0, bottom - MIN_LAYER_SIZE);
  }

  if (resizeState.handle.includes('s')) {
    bottom = clamp(bottom, top + MIN_LAYER_SIZE, CANVAS_SIZE.height);
  }

  return {
    position: {
      x: Math.round((left + right) / 2),
      y: Math.round((top + bottom) / 2),
    },
    width: Math.round(right - left),
    height: Math.round(bottom - top),
  };
}

export function getCanvasStyleValue(value: number, axis: 'x' | 'y') {
  const canvasSize = axis === 'x' ? CANVAS_SIZE.width : CANVAS_SIZE.height;

  return (value / canvasSize) * 100;
}

export function fitLayerToNaturalSize(
  layer: { position: Vector2; width: number; height: number },
  naturalSize: { width: number; height: number },
): LayerResize {
  const maxWidth = CANVAS_SIZE.width * MAX_AUTO_FIT_RATIO;
  const maxHeight = CANVAS_SIZE.height * MAX_AUTO_FIT_RATIO;
  const scale = Math.min(1, maxWidth / naturalSize.width, maxHeight / naturalSize.height);
  const width = Math.max(MIN_LAYER_SIZE, Math.round(naturalSize.width * scale));
  const height = Math.max(MIN_LAYER_SIZE, Math.round(naturalSize.height * scale));

  return {
    position: roundVector(clampLayerCenter(layer.position, width, height)),
    width,
    height,
  };
}

function getCanvasDelta(
  event: PointerEvent,
  pointerState: Pick<DragState, 'startPointerX' | 'startPointerY' | 'canvasWidth' | 'canvasHeight'>,
): Vector2 {
  const pointerDeltaX = event.clientX - pointerState.startPointerX;
  const pointerDeltaY = event.clientY - pointerState.startPointerY;

  return {
    x: (pointerDeltaX / pointerState.canvasWidth) * CANVAS_SIZE.width,
    y: (pointerDeltaY / pointerState.canvasHeight) * CANVAS_SIZE.height,
  };
}

function clampLayerCenter(position: Vector2, layerWidth: number, layerHeight: number): Vector2 {
  const halfWidth = layerWidth / 2;
  const halfHeight = layerHeight / 2;

  return {
    x: clamp(position.x, halfWidth, CANVAS_SIZE.width - halfWidth),
    y: clamp(position.y, halfHeight, CANVAS_SIZE.height - halfHeight),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundVector(position: Vector2): Vector2 {
  return {
    x: Math.round(position.x),
    y: Math.round(position.y),
  };
}
