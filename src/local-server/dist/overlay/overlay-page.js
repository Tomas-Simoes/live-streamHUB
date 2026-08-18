"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderOverlayPage = renderOverlayPage;
function renderOverlayPage() {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Live StreamHUB Overlay</title>
    <style>
      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: transparent;
      }

      body {
        font-family: Arial, sans-serif;
      }

      #overlay-root {
        position: relative;
        width: 1920px;
        height: 1080px;
        overflow: hidden;
        background: transparent;
      }

      .overlay-layer {
        position: absolute;
        box-sizing: border-box;
        color: white;
        font: 700 48px Arial, sans-serif;
        text-shadow: 0 2px 8px black;
      }

      .overlay-media {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      #overlay-error {
        position: absolute;
        left: 24px;
        top: 24px;
        max-width: 720px;
        color: #ff6b6b;
        font: 700 28px Arial, sans-serif;
        text-shadow: 0 2px 8px black;
        white-space: pre-wrap;
      }

      #overlay-debug {
        position: absolute;
        right: 16px;
        bottom: 16px;
        z-index: 2147483647;
        width: min(620px, calc(100% - 32px));
        padding: 14px 16px;
        box-sizing: border-box;
        border: 1px solid rgba(255, 255, 255, 0.25);
        background: rgba(0, 0, 0, 0.78);
        color: #d8f3ff;
        font: 16px/1.45 monospace;
        white-space: pre-wrap;
      }

      #overlay-debug[hidden] {
        display: none;
      }
    </style>
  </head>
  <body>
    <main id="overlay-root" aria-label="Live StreamHUB overlay"></main>
    <aside id="overlay-debug" aria-live="polite" hidden></aside>
    <script>
      const overlayRoot = document.getElementById('overlay-root');
      const debugPanel = document.getElementById('overlay-debug');
      const isDebugEnabled = new URLSearchParams(window.location.search).get('debug') === '1';
      const state = {
        hub: null,
        game: null,
        configStatus: 'idle',
        wsStatus: 'idle',
        error: '',
        renderCount: 0,
      };

      if (isDebugEnabled) {
        debugPanel.hidden = false;
        updateDebugPanel('overlay booted');
      }

      function getConfigUrl() {
        return window.location.pathname.replace(/\\/$/, '') + '/config';
      }

      async function loadHubConfig() {
        state.configStatus = 'fetching ' + getConfigUrl();
        updateDebugPanel('config fetch started');

        const response = await fetch(getConfigUrl(), { cache: 'no-store' });

        state.configStatus = 'response ' + response.status;
        updateDebugPanel('config response received');

        if (!response.ok) {
          throw new Error('Could not load overlay config: ' + response.status);
        }

        state.hub = await response.json();
        state.configStatus = 'loaded';
        updateDebugPanel('config loaded');
        renderOverlay();
      }

      function connectGameData() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(protocol + '//' + window.location.host + '/game-data/ws');

        state.wsStatus = 'connecting';
        updateDebugPanel('websocket connecting');

        socket.addEventListener('open', () => {
          state.wsStatus = 'open';
          updateDebugPanel('websocket open');
        });

        socket.addEventListener('message', (event) => {
          const message = JSON.parse(event.data);

          if (message.type === 'game-state') {
            state.game = message.data;
            state.wsStatus = 'received ' + (message.data && message.data.updatedAt ? message.data.updatedAt : 'game-state');
            updateDebugPanel('game-state received');
            renderOverlay();
          }
        });

        socket.addEventListener('close', () => {
          state.wsStatus = 'closed; reconnecting';
          updateDebugPanel('websocket closed');
          window.setTimeout(connectGameData, 1000);
        });

        socket.addEventListener('error', () => {
          state.wsStatus = 'error';
          updateDebugPanel('websocket error');
        });
      }

      function getLayers() {
        const layers = state.hub && state.hub.layout && state.hub.layout.layers;

        return Array.isArray(layers) ? layers : [];
      }

      function renderOverlay() {
        overlayRoot.replaceChildren();
        state.renderCount += 1;

        for (const layer of getLayers()) {
          if (layer.visible === false) continue;

          overlayRoot.appendChild(renderLayer(layer));
        }

        updateDebugPanel('overlay rendered');
      }

      function renderLayer(layer) {
        const element = document.createElement('div');
        element.className = 'overlay-layer';
        element.id = layer.id || '';
        element.style.left = toPixels(layer.position && layer.position.x);
        element.style.top = toPixels(layer.position && layer.position.y);
        element.style.width = toPixels(layer.width);
        element.style.height = toPixels(layer.height);

        if (layer.type === 'Image') {
          const image = document.createElement('img');
          image.className = 'overlay-media';
          image.src = layer.src || '';
          image.alt = layer.alt || '';
          image.style.opacity = layer.opacity ?? 1;
          element.appendChild(image);
          return element;
        }

        if (layer.type === 'Video') {
          const video = document.createElement('video');
          video.className = 'overlay-media';
          video.src = layer.src || '';
          video.autoplay = Boolean(layer.autoplay);
          video.muted = layer.muted !== false;
          video.loop = true;
          video.playsInline = true;
          element.appendChild(video);
          return element;
        }

        if (layer.type === 'Text') {
          element.textContent = layer.text || '';
          element.style.color = layer.color || 'white';

          if (layer.fontSize) {
            element.style.fontSize = toPixels(layer.fontSize);
          }

          if (layer.fontFamily) {
            element.style.fontFamily = layer.fontFamily;
          }

          return element;
        }

        element.textContent = getLayerText(layer);
        return element;
      }

      function getLayerText(layer) {
        if (layer.feature) {
          return readFeature(layer.feature);
        }

        if (layer.type === 'Kills') {
          return readFeature('team.blue.kills');
        }

        if (layer.type === 'Towers') {
          return readFeature('team.blue.objectives');
        }

        return '';
      }

      function readFeature(path) {
        if (!path || !state.game) return '';

        return path.split('.').reduce((value, key) => value && value[key], state.game) ?? '';
      }

      function toPixels(value) {
        return Number.isFinite(Number(value)) ? Number(value) + 'px' : '0px';
      }

      function showError(error) {
        overlayRoot.replaceChildren();
        state.error = error instanceof Error ? error.message : String(error);
        updateDebugPanel('overlay error');

        const element = document.createElement('div');
        element.id = 'overlay-error';
        element.textContent = state.error;
        overlayRoot.appendChild(element);
      }

      function updateDebugPanel(eventName) {
        if (!isDebugEnabled) return;

        const layers = getLayers();
        const visibleLayers = layers.filter((layer) => layer.visible !== false);
        const hub = state.hub || {};

        debugPanel.textContent = [
          'Live StreamHUB overlay debug',
          'event: ' + eventName,
          'url: ' + window.location.href,
          'config: ' + state.configStatus,
          'ws: ' + state.wsStatus,
          'hubId: ' + (hub._id || hub.id || ''),
          'hubName: ' + (hub.hubName || ''),
          'layers: ' + layers.length,
          'visibleLayers: ' + visibleLayers.length,
          'renderCount: ' + state.renderCount,
          'gameUpdatedAt: ' + (state.game && state.game.updatedAt ? state.game.updatedAt : ''),
          'error: ' + state.error,
        ].join('\\n');

        console.info('[Live StreamHUB overlay]', eventName, {
          configStatus: state.configStatus,
          wsStatus: state.wsStatus,
          hub,
          layers,
          game: state.game,
          error: state.error,
        });
      }

      loadHubConfig().catch(showError);
      connectGameData();
    </script>
  </body>
</html>`;
}
//# sourceMappingURL=overlay-page.js.map