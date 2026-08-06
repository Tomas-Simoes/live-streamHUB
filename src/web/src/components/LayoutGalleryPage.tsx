import { useEffect, useMemo, useState } from 'react';
import { getAuthSession, logout } from '../services/authService';
import { useGameDataFeed } from '../services/gameDataFeed';
import { createHubFromTemplate, getOverlayUrl, listHubs, setCurrentHub } from '../services/hubStorage';
import type { HubLayout } from '../types/hub';
import { HubRenderer } from './HubRenderer';

function openEditor(hubId: string) {
  setCurrentHub(hubId);
  window.location.href = `/editor/${encodeURIComponent(hubId)}`;
}

function openLayout(hubId: string) {
  setCurrentHub(hubId);
  window.location.href = `/layouts/${encodeURIComponent(hubId)}`;
}

export function LayoutGalleryPage() {
  const gameData = useGameDataFeed();
  const [hubs, setHubs] = useState<HubLayout[]>([]);
  const [selectedHubId, setSelectedHubId] = useState<string>();
  const [status, setStatus] = useState('Loading layouts');
  const [isCreating, setIsCreating] = useState(false);
  const session = getAuthSession();

  useEffect(() => {
    let cancelled = false;

    listHubs()
      .then((result) => {
        if (cancelled) return;
        setHubs(result.hubs);
        setSelectedHubId(result.hubs[0]?.id);
        setStatus(result.target === 'backend' ? 'Synced with backend' : 'Local layout library');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus(error instanceof Error ? error.message : 'Could not load layouts');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedHub = useMemo(
    () => hubs.find((hub) => hub.id === selectedHubId) ?? hubs[0],
    [hubs, selectedHubId],
  );

  const createNewLayout = async () => {
    if (!selectedHub) return;
    setIsCreating(true);
    const result = await createHubFromTemplate(selectedHub, 'Untitled Live Hub');
    setIsCreating(false);
    openEditor(result.hub.id);
  };

  return (
    <main className="layout-library-page">
      <header className="layout-library-header">
        <a className="brand-mark library-brand" href="/">
          <span>Marquee</span>
        </a>
        <div>
          <p className="eyebrow">{session?.user ? session.user.email : 'layout library'}</p>
          <h1>{session?.user ? 'My Hub layouts' : 'Choose a Hub layout'}</h1>
        </div>
        <div className="library-actions">
          {session ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                logout();
                window.location.href = '/login';
              }}
            >
              Logout
            </button>
          ) : (
            <a className="secondary-button" href="/login">
              Login
            </a>
          )}
          <a className="secondary-button" href="/editor">
            Open editor
          </a>
          <button className="primary-button" type="button" onClick={createNewLayout} disabled={!selectedHub || isCreating}>
            {isCreating ? 'Creating' : 'New from selected'}
          </button>
        </div>
      </header>

      <section className="layout-featured-preview">
        {selectedHub ? (
          <>
            <div className="layout-preview-stage">
              <HubRenderer hub={selectedHub} gameData={gameData} mode="overlay" />
            </div>
            <aside className="layout-preview-info">
              <p className="eyebrow">{selectedHub.game}</p>
              <h2>{selectedHub.hubName}</h2>
              <dl>
                <div>
                  <dt>Elements</dt>
                  <dd>{selectedHub.elements.length}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{new Date(selectedHub.updatedAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Overlay URL</dt>
                  <dd>{getOverlayUrl(selectedHub.id)}</dd>
                </div>
              </dl>
              <div className="layout-preview-actions">
                <button className="primary-button" type="button" onClick={() => openLayout(selectedHub.id)}>
                  Open preview
                </button>
                <button className="secondary-button" type="button" onClick={() => openEditor(selectedHub.id)}>
                  Edit layout
                </button>
              </div>
              <p className="library-status">{status}</p>
            </aside>
          </>
        ) : (
          <section className="state-panel">
            <p className="eyebrow">No layouts</p>
            <h1>No Hub layouts were found</h1>
            <p>Open the editor and save a Hub to start building your library.</p>
          </section>
        )}
      </section>

      <section className="layout-carousel-section">
        <div className="section-heading">
          <p className="eyebrow">saved hubs</p>
          <h2>Layouts</h2>
        </div>
        <div className="layout-carousel" aria-label="Saved Hub layouts">
          {hubs.map((hub) => (
            <button
              className={`layout-card ${selectedHub?.id === hub.id ? 'active' : ''}`}
              key={hub.id}
              type="button"
              onClick={() => setSelectedHubId(hub.id)}
              onDoubleClick={() => openLayout(hub.id)}
            >
              <span className="layout-card-preview">
                <HubRenderer hub={hub} gameData={gameData} mode="overlay" />
              </span>
              <span className="layout-card-meta">
                <strong>{hub.hubName}</strong>
                <small>
                  {hub.elements.length} elements / {hub.game}
                </small>
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
