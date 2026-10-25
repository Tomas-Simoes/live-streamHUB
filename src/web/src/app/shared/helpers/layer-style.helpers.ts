import { ComponentPartStyle, EditorLayer, LayerVisualStyle } from '../types/layer.types';
import { renderLayerCss } from './authored-css';

export const CUSTOM_CSS_SCOPE_ATTRIBUTE = 'data-layer-id';

export class LayerStyleSheet {
  private element: HTMLStyleElement | null = null;
  private css = '';

  update(layers: readonly EditorLayer[]) {
    const css = createScopedLayerCss(layers);

    if (css === this.css) {
      return;
    }

    this.css = css;
    if (!this.element) {
      this.element = document.createElement('style');
      document.head.appendChild(this.element);
    }
    this.element.textContent = css;
  }

  destroy() {
    this.element?.remove();
    this.element = null;
  }
}

export function createScopedLayerCss(layers: readonly EditorLayer[]) {
  return layers
    .map((layer) => createLayerCss(layer.id, layer.style?.customCss, layer.width))
    .filter(Boolean)
    .join('\n');
}

export function createLayerCss(layerId: string, customCss: string | undefined, width = 1920) {
  return renderLayerCss(customCss, layerId, width).trim();
}

export function getLayerOpacity(style: LayerVisualStyle | undefined) {
  const opacity = Number(style?.opacity);

  return Number.isFinite(opacity) ? Math.min(Math.max(opacity, 0), 100) / 100 : null;
}

export function getLayerBorderStyle(style: LayerVisualStyle | undefined) {
  return Number(style?.borderWidth) > 0 ? 'solid' : null;
}

export function getComponentPartCss(style: ComponentPartStyle | undefined, layerWidth: number): Record<string, string | number> {
  if (!style) return {};

  const css: Record<string, string | number> = {};
  if (style.backgroundColor !== undefined) css['background'] = style.backgroundColor;
  if (style.color !== undefined) css['color'] = style.color;
  if (style.opacity !== undefined) css['opacity'] = Math.min(100, Math.max(0, style.opacity)) / 100;
  const scaled = (value: number) => `${(value / layerWidth) * 100}cqw`;
  if (style.borderWidth !== undefined) {
    css['border-width'] = scaled(style.borderWidth);
    css['border-style'] = style.borderWidth > 0 ? 'solid' : 'none';
  }
  if (style.borderColor !== undefined) css['border-color'] = style.borderColor;
  if (style.borderRadius !== undefined) css['border-radius'] = scaled(style.borderRadius);
  if (style.padding !== undefined) css['padding'] = scaled(style.padding);
  if (style.boxShadow !== undefined) css['box-shadow'] = style.boxShadow;
  if (style.textShadow !== undefined) css['text-shadow'] = style.textShadow;
  if (style.fontFamily !== undefined) css['font-family'] = style.fontFamily;
  if (style.fontSize !== undefined) css['font-size'] = scaled(style.fontSize);
  if (style.fontWeight !== undefined) css['font-weight'] = style.fontWeight;
  if (style.letterSpacing !== undefined) css['letter-spacing'] = scaled(style.letterSpacing);
  if (style.textAlign !== undefined) css['text-align'] = style.textAlign;
  return css;
}

