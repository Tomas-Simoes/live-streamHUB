import type { EditorCopy, EditorLanguage } from '../../i18n/editorText';
import type { ObsConnectionState } from '../../services/obsService';

interface TopBarProps {
  appName: string;
  hubName: string;
  dataConnected: boolean;
  obsStatus: ObsConnectionState;
  saveStatus: string;
  isSaving: boolean;
  language: EditorLanguage;
  copy: EditorCopy;
  onToggleAppName: () => void;
  onHubNameChange: (name: string) => void;
  onLanguageChange: (language: EditorLanguage) => void;
  onSave: () => void;
  onPreview: () => void;
  onConnectObs: () => void;
}

export function TopBar({
  appName,
  hubName,
  dataConnected,
  obsStatus,
  saveStatus,
  isSaving,
  language,
  copy,
  onToggleAppName,
  onHubNameChange,
  onLanguageChange,
  onSave,
  onPreview,
  onConnectObs,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand-block">
        <button className="brand-mark" type="button" onClick={onToggleAppName} title="Toggle app name">
          <span>{appName}</span>
        </button>
        <div className="hub-title-group">
          <p className="eyebrow">{copy.appEyebrow}</p>
          <label className="sr-only" htmlFor="hub-title-input">
            {copy.hubName}
          </label>
          <input
            id="hub-title-input"
            className="hub-title-input"
            value={hubName}
            onChange={(event) => onHubNameChange(event.target.value)}
          />
        </div>
      </div>

      <div className="topbar-status">
        <span className={dataConnected ? 'status-pill online' : 'status-pill warning'}>
          {dataConnected ? copy.overwolfLive : copy.overwolfMock}
        </span>
        <span className={obsStatus.connected ? 'status-pill online' : 'status-pill'}>
          {obsStatus.connected ? copy.obsConnected : copy.obsDisconnected}
        </span>
        <span className="save-copy">{saveStatus}</span>
      </div>

      <div className="topbar-actions">
        <div className="language-switch" aria-label="Language">
          <button
            className={language === 'en' ? 'active' : ''}
            type="button"
            onClick={() => onLanguageChange('en')}
          >
            EN
          </button>
          <button
            className={language === 'pt' ? 'active' : ''}
            type="button"
            onClick={() => onLanguageChange('pt')}
          >
            PT
          </button>
        </div>
        <button className="secondary-button" type="button" onClick={onSave} disabled={isSaving}>
          {isSaving ? copy.saving : copy.save}
        </button>
        <button className="secondary-button" type="button" onClick={onPreview}>
          {copy.preview}
        </button>
        <button className="primary-button" type="button" onClick={onConnectObs}>
          {copy.connectObs}
        </button>
      </div>
    </header>
  );
}
