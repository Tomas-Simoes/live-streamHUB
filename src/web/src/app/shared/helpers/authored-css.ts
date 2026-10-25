import { parse, root as cssRoot, comment, type Root, type Rule, type Declaration, type AtRule } from 'postcss';
import selectorParser from 'postcss-selector-parser';
import valueParser from 'postcss-value-parser';
import type { EditorLayer } from '../types/layer.types';

const START = 'hub-authored-css';
const END = '/hub-authored-css';
const geometry = /^(?:(?:min-|max-)?(?:width|height)|position|inset(?:-.+)?|top|right|bottom|left|transform(?:-.+)?|translate|rotate|scale|display|zoom|container(?:-.+)?)$/;
const decode = (text: string) => text.replace(/\\([\da-f]{1,6})\s?|\\([^\r\n])/gi, (_all, hex, char) => hex ? String.fromCodePoint(Math.min(parseInt(hex, 16), 0x10ffff) || 0xfffd) : char);
const keyframe = (rule: Rule) => rule.parent?.type === 'atrule' && /^(?:-webkit-)?keyframes$/i.test((rule.parent as AtRule).name);

/** Parse whole CSS, including commas inside :is()/gradients and quoted strings. */
function tree(source: string): Root {
  if (source.length > 48_000) throw new Error('The component stylesheet exceeds 48 KB. Return a focused patch.');
  const result = parse(source, { from: undefined });
  if (result.nodes.some(node => node.type === 'decl')) {
    if (result.nodes.some(node => !['decl', 'comment'].includes(node.type))) throw new Error('Put declarations inside a selector block, for example & { color: white; }.');
    return parse(`& { ${source} }`, { from: undefined });
  }
  return result;
}

function scopedSelector(source: string, scope: string): string {
  return selectorParser(selectors => {
    selectors.each(selector => {
      const nesting: any[] = [];
      selector.walkNesting(node => { nesting.push(node); });
      selector.walkPseudos(node => {
        if (/^::?(?:global|host|host-context|slotted)$/i.test(decode(node.value))) throw new Error('Selectors must stay inside their component.');
      });
      if (nesting.length) {
        if (nesting.length !== 1 || nesting[0] !== selector.nodes[0]) throw new Error('Use & only at the start of a component selector.');
        const firstCombinator = selector.nodes.find(node => node.type === 'combinator');
        if (firstCombinator && ![' ', '>'].includes(firstCombinator.value.trim() || ' ')) throw new Error('A component root selector cannot select siblings outside its layer.');
        const replacement = selectorParser().astSync(scope).nodes[0].nodes.map(node => node.clone());
        nesting[0].replaceWith(...replacement);
      } else {
        if (selector.nodes[0]?.type === 'combinator') throw new Error('A relative selector must start with & and stay inside the component.');
        const prefix = selectorParser().astSync(scope).nodes[0].nodes.map(node => node.clone());
        selector.prepend(selectorParser.combinator({ value: ' ' }));
        for (const node of prefix.reverse()) selector.prepend(node);
      }
    });
  }).processSync(source);
}

/** Security restrictions are independent of visual properties or intent categories. */
export function validateAuthoredCss(source: string): Root {
  const result = tree(source);
  result.walkAtRules(rule => {
    const name = decode(rule.name).toLowerCase();
    rule.name = name;
    if (!['media', 'supports', 'container', 'layer', 'keyframes', '-webkit-keyframes'].includes(name) || !rule.nodes) {
      throw new Error(`Unsupported @${rule.name}: use local rules; imports, external fonts and resource declarations are unavailable.`);
    }
    validateValue(rule.params);
    if (/keyframes$/.test(name) && !/^[a-zA-Z_][\w-]*$/.test(rule.params)) throw new Error('Use a plain local animation name.');
  });
  result.walkRules(rule => {
    if (keyframe(rule)) {
      if (!/^(?:from|to|\d+(?:\.\d+)?%)(?:\s*,\s*(?:from|to|\d+(?:\.\d+)?%))*$/.test(rule.selector)) throw new Error('Invalid keyframe selector.');
      return;
    }
    if (rule.parent?.type === 'rule') throw new Error('Flatten nested selectors into complete component rules.');
    // In a component stylesheet, document-root spellings refer to that component.
    // This changes the scope, never the author's visual property values.
    rule.selector = selectorParser(selectors => { selectors.each(selector => {
      const first = selector.nodes[0];
      if (first && (first.type === 'tag' && ['html', 'body'].includes(first.value.toLowerCase()) || first.type === 'pseudo' && first.value === ':root')) first.replaceWith(selectorParser.nesting({ value: '&' }));
    }); }).processSync(rule.selector);
    scopedSelector(rule.selector, '[data-css-validation]');
    const rootSelector = selectorParser().astSync(rule.selector).nodes.some(selector => selector.nodes[0]?.type === 'nesting'
      && !selector.nodes.some(node => node.type === 'combinator' || node.type === 'pseudo' && node.value.startsWith('::')));
    rule.walkDecls(declaration => {
      const property = decode(declaration.prop).toLowerCase();
      if (rootSelector && (geometry.test(property) || property === 'all')) throw new Error(`Use a layout operation for root ${property}; CSS must keep editor frame geometry accurate.`);
    });
  });
  result.walkDecls(declaration => {
    const property = decode(declaration.prop).toLowerCase();
    if (!/^(?:--[\w-]+|-?[a-z][a-z0-9-]*)$/.test(property) || ['behavior', '-moz-binding'].includes(property)) throw new Error(`Invalid CSS property ${declaration.prop}.`);
    validateValue(declaration.value);
    if (!declaration.value.trim()) throw new Error(`Missing value for ${property}.`);
    if (typeof CSS !== 'undefined' && !property.startsWith('--') && !CSS.supports(property, declaration.value)) throw new Error(`Invalid CSS value: ${property}: ${declaration.value}.`);
  });
  return result;
}

function validateValue(source: string) {
  if (/[<>\u0000]/.test(source)) throw new Error('CSS cannot contain markup or null characters.');
  valueParser(source).walk(node => {
    if (node.type === 'function' && ['url', 'src', 'image', 'image-set', '-webkit-image-set', 'paint', 'expression', 'attr'].includes(decode(node.value).toLowerCase())) {
      throw new Error('CSS resource loading and dynamic resource functions are unavailable. Use existing image components.');
    }
    if ((node as any).unclosed) throw new Error('Unclosed CSS function or string.');
  });
}

function split(source: string) {
  const original = tree(source), legacy = cssRoot(), authored = cssRoot();
  let inside = false;
  for (const node of original.nodes) {
    if (node.type === 'comment' && node.text === START) { inside = true; continue; }
    if (node.type === 'comment' && node.text === END) { inside = false; continue; }
    (inside ? authored : legacy).append(node.clone());
  }
  return { legacy, authored };
}

export function authoredCss(source?: string): string {
  if (!source) return '';
  return split(source).authored.toString();
}

/** Patch declaration identities, preserving unrelated rules and conditional contexts. */
export function patchAuthoredCss(current: string | undefined, patch: string, mode: 'patch' | 'replace' = 'patch'): string {
  const incoming = validateAuthoredCss(patch);
  const { legacy, authored } = mode === 'replace' ? { legacy: cssRoot(), authored: cssRoot() } : split(current ?? '');
  const identity = (rule: Rule) => {
    const parents: string[] = [];
    for (let parent = rule.parent; parent?.type === 'atrule'; parent = parent.parent) parents.unshift(`@${(parent as AtRule).name} ${(parent as AtRule).params}`);
    // '& .name' and '.name' render to the same scoped selector. Treat them
    // identically while patching too, rather than retaining stale declarations.
    return `${parents.join('|')}|${selectorParser().processSync(keyframe(rule) ? rule.selector : scopedSelector(rule.selector, '[data-css-identity]'), { lossless: false })}`;
  };
  incoming.walkRules(rule => {
    const properties = new Set(rule.nodes.filter(node => node.type === 'decl').map(node => (node as Declaration).prop));
    authored.walkRules(old => {
      if (identity(old) === identity(rule)) old.walkDecls(declaration => { if (properties.has(declaration.prop)) declaration.remove(); });
    });
  });
  authored.walkRules(rule => { if (!rule.nodes.length) rule.remove(); });
  authored.append(incoming.nodes.map(node => node.clone()));
  legacy.append(comment({ text: START }), ...authored.nodes.map(node => node.clone()), comment({ text: END }));
  return legacy.toString();
}

/** Render from saved native units; preview ID changes never alter the saved CSS. */
export function compileAuthoredCss(source: string, layerId: string, width: number): string {
  const result = validateAuthoredCss(source);
  const escaped = layerId.replace(/[^\w-]/g, char => `\\${char.codePointAt(0)!.toString(16)} `);
  const scope = `[data-layer-id="${escaped}"][data-layer-id="${escaped}"]`;
  const animations = new Map<string, string>();
  result.walkAtRules(rule => { if (/keyframes$/.test(rule.name)) { const name = `hub-${escaped.replace(/[^\w-]/g, '')}-${rule.params}`; animations.set(rule.params, name); rule.params = name; } });
  result.walkAtRules(rule => { if (rule.name === 'layer' && rule.params.trim()) rule.params = rule.params.split('.').map(name => `hub-${escaped.replace(/[^\w-]/g, '')}-${name.trim()}`).join('.'); });
  result.walkRules(rule => { if (!keyframe(rule)) rule.selector = scopedSelector(rule.selector, scope); });
  result.walkDecls(declaration => {
    const value = valueParser(declaration.value);
    value.walk(node => {
      if (node.type === 'word') {
        const dimension = valueParser.unit(node.value);
        if (dimension && dimension.unit === 'px') node.value = `${Math.round(Number(dimension.number) / width * 100000) / 1000}cqw`;
        if (/^(?:animation|animation-name)$/.test(declaration.prop) && animations.has(node.value)) node.value = animations.get(node.value)!;
      }
    });
    declaration.value = value.toString();
    // Existing native controls bind inline. Authored styles intentionally win;
    // manual controls remove conflicting authored declarations before updating.
    if (!(declaration.parent?.type === 'rule' && keyframe(declaration.parent as Rule))) declaration.important = true;
  });
  return result.toString();
}

/** Reuse parsed scoping for old custom CSS; old stored native units stay unchanged. */
export function compileLegacyCss(source: string, layerId: string): string {
  const result = tree(source), escaped = layerId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const scope = `[data-layer-id="${escaped}"][data-layer-id="${escaped}"]`;
  result.walkAtRules(rule => { if (!['media', 'supports', 'container', 'layer'].includes(rule.name)) rule.remove(); });
  result.walkRules(rule => { rule.selector = scopedSelector(rule.selector, scope); });
  return result.toString();
}

export function renderLayerCss(source: string | undefined, layerId: string, width = 1920): string {
  if (!source?.trim()) return '';
  try {
    const { legacy, authored } = split(source);
    return `${compileLegacyCss(legacy.toString(), layerId)}\n${compileAuthoredCss(authored.toString(), layerId, width)}`;
  } catch { return ''; } // A manual draft must not crash the editor while being typed.
}

export function clearAuthoredProperties(source: string | undefined, properties: string[], part?: string): string | undefined {
  if (!source || !properties.length) return source;
  const { legacy, authored } = split(source);
  const affected = (property: string) => properties.some(changed => property === changed || property.startsWith(changed + '-') || changed.startsWith(property + '-'));
  authored.walkRules(rule => {
    if (part) {
      const selectors = selectorParser().astSync(rule.selector);
      const classParts: Record<string, string[]> = { name: ['roster-name'], cs: ['roster-stat'], gold: ['roster-stat'], kda: ['roster-kda'], portrait: ['roster-portrait'], item: ['item-slot'], items: ['roster-items'], row: ['roster-row'], text: ['text-layer'], 'blue-code': ['team-code'], 'red-code': ['team-code'], 'blue-kills': ['team-kills'], 'red-kills': ['team-kills'], clock: ['game-clock'], 'blue-team': ['scorebug-team','scorebug-team-blue'], 'red-team': ['scorebug-team','scorebug-team-red'], center: ['scorebug-center'] };
      const selected: string[] = [], untouched: string[] = [];
      const broad: string[] = [];
      selectors.each(selector => {
        let match = false, exact = false;
        selector.walkAttributes(node => { if (node.attribute === 'data-component-part' && node.value === part) { match = true; exact = true; } });
        selector.walkClasses(node => { if (classParts[part]?.includes(node.value)) match = true; });
        (match ? selected : untouched).push(selector.toString());
        if (match && !exact) broad.push(`${selector.toString()}:not([data-component-part="${part}"])`);
      });
      if (!selected.length) return;
      if (untouched.length) rule.cloneBefore({ selector: untouched.join(',') });
      if (broad.length) rule.cloneBefore({ selector: broad.join(',') });
      rule.selector = selected.join(',');
    }
    rule.walkDecls(declaration => { if (affected(declaration.prop)) declaration.remove(); });
  });
  authored.walkRules(rule => { if (!rule.nodes.length) rule.remove(); });
  legacy.append(comment({ text: START }), ...authored.nodes.map(node => node.clone()), comment({ text: END }));
  return legacy.toString();
}

/** Ordinary inspector changes remain authoritative over earlier authored CSS. */
export function reconcileManualCss(layer: EditorLayer, changes: Partial<EditorLayer>): Partial<EditorLayer> {
  if (!authoredCss(layer.style?.customCss) || changes.style?.customCss !== undefined && changes.style.customCss !== layer.style?.customCss) return changes;
  const property = (key: string) => ({ backgroundColor: 'background', bold: 'font-weight', color: 'color', fontFamily: 'font-family', fontSize: 'font-size', fontWeight: 'font-weight', uppercase: 'text-transform' } as Record<string, string>)[key] ?? key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
  let source = layer.style?.customCss;
  const changed = Object.keys(changes.style ?? {}).filter(key => key !== 'customCss' && (changes.style as any)[key] !== (layer.style as any)?.[key]).map(property);
  source = clearAuthoredProperties(source, changed);
  const text = ['fontFamily', 'fontSize', 'fontWeight', 'bold', 'color', 'letterSpacing', 'textAlign', 'lineHeight', 'uppercase'].filter(key => key in changes && (changes as any)[key] !== (layer as any)[key]).map(property);
  source = clearAuthoredProperties(source, text);
  if ('partStyles' in changes) for (const [part, values] of Object.entries((changes as any).partStyles ?? {})) {
    const old = (layer as any).partStyles?.[part] ?? {};
    source = clearAuthoredProperties(source, Object.keys(values as object).filter(key => (values as any)[key] !== old[key]).map(property), part);
  }
  return { ...changes, style: { ...layer.style, ...changes.style, customCss: source } };
}

/** Validate an explicit user boundary such as "only change the names' font".
 * This never changes the generation tools or selects any visual values. */
export function cssChangesOutside(sourceBefore: string, sourceAfter: string, selector: string, properties: string[]): string[] {
  const canonical = (source: string) => selectorParser(selectors => {
    selectors.walkClasses(node => {
      const part = ({ 'roster-name': 'name', 'roster-kda': 'kda', 'roster-portrait': 'portrait', 'roster-items': 'items', 'item-slot': 'item', 'roster-row': 'row', 'text-layer': 'text' } as Record<string, string>)[node.value];
      if (part) node.replaceWith(selectorParser.attribute({ attribute: 'data-component-part', operator: '=', value: part, quoteMark: '"', raws: {} }));
    });
    selectors.walkAttributes(node => { if (node.value !== undefined) node.setValue(node.value, { quoteMark: '"' }); });
  }).processSync(source, { lossless: false });
  const allowed = selectorParser().astSync(canonical(selector));
  const allowedSubjects = allowed.nodes.map(selector => {
    const last = selector.nodes.map(node => node.type).lastIndexOf('combinator');
    return selector.nodes.slice(last + 1).filter(node => node.type !== 'nesting').map(node => node.toString()).join('');
  });
  const index = (source: string) => {
    const result = new Map<string, { selector: string; property: string; value: string }>();
    tree(source).walkRules(rule => {
      const condition: string[] = [];
      for (let parent = rule.parent; parent?.type === 'atrule'; parent = parent.parent) condition.push((parent as AtRule).name + ':' + (parent as AtRule).params);
      selectorParser().astSync(canonical(rule.selector)).each(selector => {
        for (const declaration of rule.nodes.filter(node => node.type === 'decl') as Declaration[]) {
          const name = selector.toString();
          result.set(`${condition.join('|')}|${name}|${declaration.prop}`, { selector: name, property: declaration.prop, value: `${declaration.value}${declaration.important ? '!important' : ''}` });
        }
      });
    });
    return result;
  };
  const before = index(sourceBefore), after = index(sourceAfter), changes: string[] = [];
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const old = before.get(key), next = after.get(key);
    if (old?.value === next?.value) continue;
    const change = next ?? old!;
    const parsed = selectorParser().astSync(change.selector).nodes[0];
    const last = parsed.nodes.map(node => node.type).lastIndexOf('combinator');
    const subject = parsed.nodes.slice(last + 1).filter(node => node.type !== 'nesting').map(node => node.toString()).join('');
    if (!properties.includes(change.property) || !allowedSubjects.includes(subject)) changes.push(`${change.selector}: ${change.property}`);
  }
  return changes;
}
