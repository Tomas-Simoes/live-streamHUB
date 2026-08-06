import type { HubLayout, SaveResult } from '../types/hub';
import { getAccessToken, getAuthHeaders } from './authService';
import { createDefaultHub, DEFAULT_HUB_ID } from './defaultHub';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const HUBS_STORAGE_KEY = 'live-streamhub.hubs.v1';
const CURRENT_HUB_KEY = 'live-streamhub.currentHubId.v1';

interface BackendHub {
  _id?: string;
  id?: string;
  hubName?: string;
  game?: string;
  layout?: HubLayout;
  createdAt?: string;
  updatedAt?: string;
}

function readStoredHubs(): Record<string, HubLayout> {
  try {
    const raw = window.localStorage.getItem(HUBS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, HubLayout>) : {};
  } catch {
    return {};
  }
}

function writeStoredHubs(hubs: Record<string, HubLayout>): void {
  window.localStorage.setItem(HUBS_STORAGE_KEY, JSON.stringify(hubs));
}

function normalizeBackendHub(payload: BackendHub): HubLayout | undefined {
  if (payload.layout?.elements) {
    return {
      ...payload.layout,
      id: payload.layout.id || payload._id || payload.id || DEFAULT_HUB_ID,
      backendId: payload._id || payload.layout.backendId,
      hubName: payload.layout.hubName || payload.hubName || 'Untitled Hub',
      game: payload.layout.game || payload.game || 'Esports',
      updatedAt: payload.layout.updatedAt || payload.updatedAt || payload.createdAt || new Date().toISOString(),
    };
  }

  return undefined;
}

function sortHubs(hubs: HubLayout[]): HubLayout[] {
  return hubs
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function loadHub(hubId?: string): Promise<HubLayout> {
  const storedHubs = readStoredHubs();
  const currentId = hubId || window.localStorage.getItem(CURRENT_HUB_KEY) || DEFAULT_HUB_ID;

  if (storedHubs[currentId]) {
    window.localStorage.setItem(CURRENT_HUB_KEY, storedHubs[currentId].id);
    return storedHubs[currentId];
  }

  try {
    const response = await fetch(`${API_BASE_URL}/hub/${currentId}`);
    if (response.ok) {
      const backendHub = normalizeBackendHub((await response.json()) as BackendHub);
      if (backendHub) {
        saveHubLocally(backendHub);
        return backendHub;
      }
    }
  } catch {
    // Local-first keeps the editor usable when the backend is not running.
  }

  const defaultHub = createDefaultHub();
  saveHubLocally(defaultHub);
  return defaultHub;
}

export async function listHubs(): Promise<{ hubs: HubLayout[]; target: 'backend' | 'local' }> {
  const storedHubs = Object.values(readStoredHubs());
  const token = getAccessToken();

  if (!token) {
    const fallbackHub = storedHubs.length > 0 ? undefined : createDefaultHub();
    if (fallbackHub) saveHubLocally(fallbackHub);

    return {
      hubs: sortHubs(fallbackHub ? [fallbackHub] : storedHubs),
      target: 'local',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/hub/mine`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error(`Backend list failed with ${response.status}`);

    const backendHubs = ((await response.json()) as BackendHub[])
      .map(normalizeBackendHub)
      .filter((hub): hub is HubLayout => Boolean(hub));

    const hubs = sortHubs(backendHubs);
    const nextStoredHubs = readStoredHubs();
    hubs.forEach((hub) => {
      nextStoredHubs[hub.id] = hub;
    });
    writeStoredHubs(nextStoredHubs);

    return {
      hubs,
      target: 'backend',
    };
  } catch {
    const fallbackHub = storedHubs.length > 0 ? undefined : createDefaultHub();
    if (fallbackHub) saveHubLocally(fallbackHub);

    return {
      hubs: sortHubs(fallbackHub ? [fallbackHub] : storedHubs),
      target: 'local',
    };
  }
}

export function saveHubLocally(hub: HubLayout): HubLayout {
  const nextHub = {
    ...hub,
    updatedAt: new Date().toISOString(),
  };
  const storedHubs = readStoredHubs();
  storedHubs[nextHub.id] = nextHub;
  writeStoredHubs(storedHubs);
  window.localStorage.setItem(CURRENT_HUB_KEY, nextHub.id);
  return nextHub;
}

export async function saveHub(hub: HubLayout): Promise<SaveResult> {
  const localHub = saveHubLocally(hub);

  try {
    const backendId = localHub.backendId;
    const url = backendId ? `${API_BASE_URL}/hub/update/${backendId}` : `${API_BASE_URL}/hub/create`;
    const method = backendId ? 'PATCH' : 'POST';
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        hubName: localHub.hubName,
        layout: localHub,
        imgs: [],
        features: [],
      }),
    });

    if (!response.ok) throw new Error(`Backend save failed with ${response.status}`);

    const backendHub = normalizeBackendHub((await response.json()) as BackendHub);
    if (backendHub) {
      const savedHub = saveHubLocally({
        ...backendHub,
        id: localHub.id,
        backendId: backendHub.backendId || backendHub.id || localHub.backendId,
      });

      return {
        hub: savedHub,
        target: 'backend',
        message: 'Saved to backend',
      };
    }
  } catch {
    // The local copy is already saved; this is the expected dev fallback.
  }

  return {
    hub: localHub,
    target: 'local',
    message: 'Saved locally',
  };
}

export function setCurrentHub(hubId: string): void {
  window.localStorage.setItem(CURRENT_HUB_KEY, hubId);
}

export async function createHubFromTemplate(sourceHub: HubLayout, name?: string): Promise<SaveResult> {
  const now = new Date().toISOString();
  const newHub: HubLayout = {
    ...sourceHub,
    id: `hub-${Date.now()}`,
    backendId: undefined,
    hubName: name || `${sourceHub.hubName} Copy`,
    elements: sourceHub.elements.map((element) => ({
      ...element,
      id: `${element.id}-${Date.now()}`,
      content: { ...element.content },
      style: { ...element.style },
    })),
    updatedAt: now,
  };

  return saveHub(newHub);
}

export function getOverlayUrl(hubId: string): string {
  const origin = window.location.origin;
  return `${origin}/overlay/${encodeURIComponent(hubId)}`;
}
