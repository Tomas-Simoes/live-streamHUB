import { useMemo, useState } from 'react';
import {
  loadObsSettings,
  obsBrowserSourceService,
  type ObsConnectionSettings,
  type ObsConnectionState,
} from '../services/obsService';

interface ObsConnectModalProps {
  overlayUrl: string;
  onClose: () => void;
  onStatusChange: (status: ObsConnectionState) => void;
}

export function ObsConnectModal({ overlayUrl, onClose, onStatusChange }: ObsConnectModalProps) {
  const initialSettings = useMemo(() => loadObsSettings(), []);
  const [settings, setSettings] = useState<ObsConnectionSettings>(initialSettings);
  const [status, setStatus] = useState<ObsConnectionState>(obsBrowserSourceService.getState());
  const [isWorking, setIsWorking] = useState(false);

  const updateSetting = <K extends keyof ObsConnectionSettings>(
    key: K,
    value: ObsConnectionSettings[K],
  ) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const connect = async () => {
    setIsWorking(true);
    const nextStatus = await obsBrowserSourceService.connect(settings);
    setStatus(nextStatus);
    onStatusChange(nextStatus);
    setIsWorking(false);
  };

  const createSource = async () => {
    setIsWorking(true);
    const nextStatus = await obsBrowserSourceService.createOrUpdateBrowserSource(settings, overlayUrl);
    setStatus(nextStatus);
    onStatusChange(nextStatus);
    setIsWorking(false);
  };

  const disconnect = async () => {
    setIsWorking(true);
    const nextStatus = await obsBrowserSourceService.disconnect();
    setStatus(nextStatus);
    onStatusChange(nextStatus);
    setIsWorking(false);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="obs-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">OBS Browser Source</p>
            <h2>Connect Overlay</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            X
          </button>
        </header>

        <div className="obs-status-line">
          <span className={status.connected ? 'status-dot status-ok' : 'status-dot'} />
          <span>{status.message}</span>
        </div>

        <div className="form-grid two-columns">
          <label>
            Host
            <input value={settings.host} onChange={(event) => updateSetting('host', event.target.value)} />
          </label>
          <label>
            Port
            <input
              type="number"
              value={settings.port}
              onChange={(event) => updateSetting('port', Number(event.target.value))}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={settings.password}
              onChange={(event) => updateSetting('password', event.target.value)}
            />
          </label>
          <label>
            Scene
            <input
              value={settings.sceneName}
              onChange={(event) => updateSetting('sceneName', event.target.value)}
            />
          </label>
        </div>

        <label>
          Source Name
          <input
            value={settings.sourceName}
            onChange={(event) => updateSetting('sourceName', event.target.value)}
          />
        </label>

        <label>
          Overlay URL
          <input readOnly value={overlayUrl} />
        </label>

        <footer className="modal-actions">
          <button className="secondary-button" type="button" onClick={disconnect} disabled={isWorking}>
            Disconnect
          </button>
          <button className="secondary-button" type="button" onClick={connect} disabled={isWorking}>
            Connect
          </button>
          <button className="primary-button" type="button" onClick={createSource} disabled={isWorking}>
            Create Browser Source
          </button>
        </footer>

        <p className="modal-note">
          Mock mode is active. The service boundary is ready for obs-websocket-js.
        </p>
      </section>
    </div>
  );
}
