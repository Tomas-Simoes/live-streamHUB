import { useEffect, useState } from 'react';
import { useGameDataFeed } from '../services/gameDataFeed';
import { getOverlayUrl, loadHub, setCurrentHub } from '../services/hubStorage';
import type { HubLayout } from '../types/hub';
import { HubRenderer } from './HubRenderer';

interface LayoutPreviewPageProps {
  hubId: string;
}

function editLayout(hubId: string) {
  setCurrentHub(hubId);
  window.location.href = `/editor/${encodeURIComponent(hubId)}`;
}

export function LayoutPreviewPage({ hubId }: LayoutPreviewPageProps) {
  const gameData = useGameDataFeed();
  const [hub, setHub] = useState<HubLayout | null>(null);
  const [error, setError] = useState<string>();
  const [streamStatus, setStreamStatus] = useState('OBS integration pending');

  useEffect(() => {
    let cancelled = false;

    loadHub(hubId)
      .then((loadedHub) => {
        if (!cancelled) {
          setHub(loadedHub);
          setCurrentHub(loadedHub.id);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load layout');
      });

    return () => {
      cancelled = true;
    };
  }, [hubId]);

  if (error) {
    return (
      <main className="layout-library-page centered-state">
        <section className="state-panel">
          <p className="eyebrow">Layout error</p>
          <h1>{error}</h1>
          <a className="secondary-button" href="/layouts">
            Back to layouts
          </a>
        </section>
      </main>
    );
  }

  if (!hub) {
    return (
      <main className="layout-library-page centered-state">
        <section className="state-panel">
          <p className="eyebrow">Loading</p>
          <h1>Preparing layout preview</h1>
        </section>
      </main>
    );
  }

  const overlayUrl = getOverlayUrl(hub.id);

  return (
    <main className="layout-detail-page">
      <header className="layout-library-header">
        <a className="brand-mark library-brand" href="/">
          <span>Marquee</span>
        </a>
        <div>
          <p className="eyebrow">layout preview</p>
          <h1>{hub.hubName}</h1>
        </div>
        <div className="library-actions">
          <a className="secondary-button" href="/layouts">
            All layouts
          </a>
          <button className="secondary-button" type="button" onClick={() => editLayout(hub.id)}>
            Edit layout
          </button>
          <button className="primary-button" type="button" onClick={() => setStreamStatus('Ready for OBS Browser Source')}>
            Start stream
          </button>
        </div>
      </header>

      <section className="layout-detail-grid">
        <div className="layout-detail-preview">
          <HubRenderer hub={hub} gameData={gameData} mode="overlay" />
        </div>

        <aside className="layout-detail-panel">
          <p className="eyebrow">{hub.game}</p>
          <h2>Broadcast handoff</h2>
          <dl>
            <div>
              <dt>Resolution</dt>
              <dd>
                {hub.canvas.width} x {hub.canvas.height}
              </dd>
            </div>
            <div>
              <dt>Elements</dt>
              <dd>{hub.elements.length}</dd>
            </div>
            <div>
              <dt>Data feed</dt>
              <dd>{gameData.connected ? 'Backend live' : 'Mock live'}</dd>
            </div>
            <div>
              <dt>OBS status</dt>
              <dd>{streamStatus}</dd>
            </div>
          </dl>

          <label>
            Browser Source URL
            <input value={overlayUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
          </label>

          <div className="layout-preview-actions">
            <a className="primary-button" href={`/overlay/${encodeURIComponent(hub.id)}`} target="_blank" rel="noreferrer">
              Open OBS preview
            </a>
            <button className="secondary-button" type="button" onClick={() => navigator.clipboard?.writeText(overlayUrl)}>
              Copy URL
            </button>
          </div>

          <p className="library-status">Start stream is a mock handoff for now; OBS websocket wiring can plug into this action later.</p>
        </aside>
      </section>
    </main>
  );
}
