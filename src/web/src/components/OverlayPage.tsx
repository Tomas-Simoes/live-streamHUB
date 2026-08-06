import { useEffect, useState } from 'react';
import { useGameDataFeed } from '../services/gameDataFeed';
import { loadHub } from '../services/hubStorage';
import type { HubLayout } from '../types/hub';
import { HubRenderer } from './HubRenderer';

interface OverlayPageProps {
  hubId: string;
}

export function OverlayPage({ hubId }: OverlayPageProps) {
  const gameData = useGameDataFeed();
  const [hub, setHub] = useState<HubLayout | null>(null);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    document.body.classList.add('overlay-body');

    return () => {
      document.body.classList.remove('overlay-body');
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadHub(hubId)
      .then((loadedHub) => {
        if (!cancelled) setHub(loadedHub);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Overlay failed to load');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hubId]);

  if (error) {
    return (
      <main className="overlay-page overlay-state">
        <p>{error}</p>
      </main>
    );
  }

  if (!hub) {
    return (
      <main className="overlay-page overlay-state">
        <p>Loading overlay</p>
      </main>
    );
  }

  return (
    <main className="overlay-page">
      <HubRenderer hub={hub} gameData={gameData} mode="overlay" />
    </main>
  );
}
