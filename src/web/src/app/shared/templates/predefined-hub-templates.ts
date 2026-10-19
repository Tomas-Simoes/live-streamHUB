import { Hub, HubLayout } from '../types/hub.types';
import { createCblolBroadcastHubLayout } from './league-broadcast-hub.template';
import { createLeagueBroadcastPresetLayout } from './league-broadcast-presets.template';

export type PredefinedHubTemplate = {
  id: string;
  name: string;
  category: string;
  description: string;
  features: string[];
  createLayout: () => HubLayout;
  previewHub: Hub;
};

function createTemplatePreviewHub(template: Omit<PredefinedHubTemplate, 'previewHub'>): Hub {
  const layout = template.createLayout();

  return {
    _id: `template-preview-${template.id}`,
    hubName: template.name,
    layers: layout.layers ?? [],
    layout,
  };
}

function createTemplate(template: Omit<PredefinedHubTemplate, 'previewHub'>): PredefinedHubTemplate {
  return {
    ...template,
    previewHub: createTemplatePreviewHub(template),
  };
}

export const PREDEFINED_HUB_TEMPLATES: PredefinedHubTemplate[] = [
  createTemplate({
    id: 'cblol-broadcast',
    name: 'CBLOL Broadcast Hub',
    category: 'League of Legends',
    description: 'A CBLOL-inspired match overlay with a top scorebug and centered player scoreboard.',
    features: ['Scorebug', 'Player scoreboard', 'Champion portraits', 'Item slots', 'Broadcast layout'],
    createLayout: createCblolBroadcastHubLayout,
  }),
  createTemplate({
    id: 'atelier-broadcast', name: 'Atelier', category: 'Premium League Broadcast',
    description: 'Quiet silver and sea-glass framing, tailored typography, and a precise editorial scorebug.',
    features: ['Minimal', 'Sea glass', 'Tailored frame'],
    createLayout: () => createLeagueBroadcastPresetLayout('atelier'),
  }),
  createTemplate({
    id: 'voltage-broadcast', name: 'Voltage', category: 'Futurist League Broadcast',
    description: 'Neon circuit lines, clipped panels, and a high-contrast night-feed scoreboard.',
    features: ['Neon', 'Angular', 'Circuit feed'],
    createLayout: () => createLeagueBroadcastPresetLayout('voltage'),
  }),
  createTemplate({
    id: 'pulse-broadcast', name: 'Pulse', category: 'Modern League Broadcast',
    description: 'Electric blue and coral team fields with fast, emphatic broadcast geometry.',
    features: ['Kinetic', 'Split color', 'Bold type'],
    createLayout: () => createLeagueBroadcastPresetLayout('pulse'),
  }),
  createTemplate({
    id: 'crown-broadcast', name: 'Crown', category: 'Championship Broadcast',
    description: 'A ceremonial amethyst and gold frame with refined type and double-line details.',
    features: ['Ceremonial', 'Amethyst', 'Gold detail'],
    createLayout: () => createLeagueBroadcastPresetLayout('crown'),
  }),
  createTemplate({
    id: 'offset-broadcast', name: 'Offset', category: 'Editorial League Broadcast',
    description: 'Acid-green editorial bars, asymmetric accents, and a sharp graphic grid.',
    features: ['Editorial', 'Asymmetric', 'Graphic'],
    createLayout: () => createLeagueBroadcastPresetLayout('offset'),
  }),
  createTemplate({
    id: 'foundry-broadcast', name: 'Foundry', category: 'Industrial League Broadcast',
    description: 'Heavy steel surfaces, signal-yellow rails, and robust utility typography.',
    features: ['Industrial', 'Signal rails', 'Heavy type'],
    createLayout: () => createLeagueBroadcastPresetLayout('foundry'),
  }),
];

export function getPredefinedHubTemplate(templateId: string) {
  return PREDEFINED_HUB_TEMPLATES.find((template) => template.id === templateId) ?? null;
}
