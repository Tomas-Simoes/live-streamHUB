import { useEffect, useState } from 'react';
import type { NormalizedGameState } from '../types/hub';
import { createMockGameState } from './mockGameData';

type Unsubscribe = () => void;
type GameDataListener = (state: NormalizedGameState) => void;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const LIVE_URL = import.meta.env.VITE_GAME_DATA_LIVE_URL || `${API_BASE_URL}/game-data/live`;

function normalizeBackendState(value: unknown): NormalizedGameState | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const candidate = value as Partial<NormalizedGameState>;
  if (!candidate.game || !candidate.team || !candidate.player || !candidate.events) {
    return undefined;
  }

  return {
    ...(candidate as NormalizedGameState),
    source: 'backend',
    connected: true,
    updatedAt: candidate.updatedAt || new Date().toISOString(),
  };
}

function startMockFeed(listener: GameDataListener): Unsubscribe {
  let tick = 0;
  listener(createMockGameState(tick));

  const interval = window.setInterval(() => {
    tick += 1;
    listener(createMockGameState(tick));
  }, 1000);

  return () => window.clearInterval(interval);
}

export function subscribeToGameData(listener: GameDataListener): Unsubscribe {
  let mockUnsubscribe: Unsubscribe | undefined;
  let events: EventSource | undefined;
  let settled = false;

  const startMock = () => {
    if (mockUnsubscribe) return;
    mockUnsubscribe = startMockFeed(listener);
  };

  const fallbackTimer = window.setTimeout(() => {
    if (!settled) startMock();
  }, 1200);

  fetch(`${API_BASE_URL}/game-data/state`)
    .then((response) => (response.ok ? response.json() : Promise.reject()))
    .then((payload) => {
      const state = normalizeBackendState(payload);
      if (state) {
        settled = true;
        listener(state);
      }
    })
    .catch(() => {
      if (!settled) startMock();
    });

  if ('EventSource' in window) {
    events = new EventSource(LIVE_URL);

    events.addEventListener('open', () => {
      settled = true;
      if (mockUnsubscribe) {
        mockUnsubscribe();
        mockUnsubscribe = undefined;
      }
    });

    events.addEventListener('message', (event) => {
      try {
        const state = normalizeBackendState(JSON.parse(event.data));
        if (state) listener(state);
      } catch {
        startMock();
      }
    });

    events.addEventListener('error', startMock);
  } else {
    startMock();
  }

  return () => {
    window.clearTimeout(fallbackTimer);
    mockUnsubscribe?.();
    events?.close();
  };
}

export function useGameDataFeed(): NormalizedGameState {
  const [gameData, setGameData] = useState<NormalizedGameState>(() => createMockGameState());

  useEffect(() => subscribeToGameData(setGameData), []);

  return gameData;
}
