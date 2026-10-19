/** Component treatments shared by authored hubs and independently composed hubs. */
export function broadcastRowSurface(treatment: 'alternating' | 'team-gradient' | 'flat', accent: string, surface: string, deep: string, even = false) {
  if (treatment === 'flat') return deep;
  if (treatment === 'alternating') return even ? deep : surface;
  return `linear-gradient(90deg, color-mix(in srgb, ${accent} ${even ? 10 : 32}%, ${deep}), ${deep} ${even ? 80 : 70}%)`;
}

export function broadcastHeaderAccent(treatment: 'none' | 'split' | 'underline', left: string, right: string) {
  if (treatment === 'split') return `&::before, &::after { content: ''; position: absolute; top: 0; bottom: 0; width: 1.4%; pointer-events: none; } &::before { left: 0; background: ${left}; } &::after { right: 0; background: ${right}; }`;
  if (treatment === 'underline') return `& { box-shadow: inset 0 -2px ${left}; }`;
  return '';
}
