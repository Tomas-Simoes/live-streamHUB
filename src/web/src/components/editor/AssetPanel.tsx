import { useState, type ChangeEvent } from 'react';
import type { EditorCopy } from '../../i18n/editorText';
import type { DataBindingDefinition, HubElement } from '../../types/hub';
import { DataWidgetLibrary } from './DataWidgetLibrary';

interface AssetPanelProps {
  imageUrl: string;
  groupedBindings: Record<string, DataBindingDefinition[]>;
  recentElements: HubElement[];
  copy: EditorCopy;
  onImageUrlChange: (value: string) => void;
  onAddText: () => void;
  onAddImage: () => void;
  onUploadImage: (event: ChangeEvent<HTMLInputElement>) => void;
  onAddWidget: (bindingKey: string) => void;
  onAddScoreboard: () => void;
  onAddLowerThird: () => void;
  onSelectRecent: (elementId: string) => void;
}

type LibraryTab = 'text' | 'assets' | 'data' | 'scoreboards' | 'recent';

export function AssetPanel({
  imageUrl,
  groupedBindings,
  recentElements,
  copy,
  onImageUrlChange,
  onAddText,
  onAddImage,
  onUploadImage,
  onAddWidget,
  onAddScoreboard,
  onAddLowerThird,
  onSelectRecent,
}: AssetPanelProps) {
  const [activeTab, setActiveTab] = useState<LibraryTab>('text');
  const tabs: Array<{ id: LibraryTab; label: string }> = [
    { id: 'text', label: copy.text },
    { id: 'assets', label: copy.assets },
    { id: 'data', label: copy.gameData },
    { id: 'scoreboards', label: copy.scoreboards },
    { id: 'recent', label: copy.recent },
  ];

  return (
    <aside className="left-sidebar">
      <div className="sidebar-tabs library-tabs" aria-label="Hub element library">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="sidebar-panel">
        {activeTab === 'text' ? (
          <section className="tool-section compact-section">
            <div className="section-heading">
              <p className="eyebrow">{copy.assets}</p>
              <h2>{copy.text}</h2>
            </div>
            <button className="tool-button marquee-command" type="button" onClick={onAddText}>
              <span>T</span>
              {copy.addText}
            </button>
            <button className="tool-button" type="button" onClick={onAddLowerThird}>
              <span>EV</span>
              {copy.lowerThird}
            </button>
          </section>
        ) : null}

        {activeTab === 'assets' ? (
          <section className="tool-section compact-section">
            <div className="section-heading">
              <p className="eyebrow">{copy.assets}</p>
              <h2>{copy.imageUrl}</h2>
            </div>
            <div className="image-adder">
              <input value={imageUrl} onChange={(event) => onImageUrlChange(event.target.value)} />
              <button className="tool-button" type="button" onClick={onAddImage}>
                <span>+</span>
                {copy.addImageUrl}
              </button>
              <label className="file-button">
                {copy.uploadMock}
                <input type="file" accept="image/*" onChange={onUploadImage} />
              </label>
            </div>
          </section>
        ) : null}

        {activeTab === 'data' ? (
          <DataWidgetLibrary groupedBindings={groupedBindings} copy={copy} onAddWidget={onAddWidget} />
        ) : null}

        {activeTab === 'scoreboards' ? (
          <section className="tool-section compact-section">
            <div className="section-heading">
              <p className="eyebrow">{copy.scoreboards}</p>
              <h2>{copy.scoreboards}</h2>
            </div>
            <button className="tool-button" type="button" onClick={onAddScoreboard}>
              <span>01</span>
              {copy.classicScorebug}
            </button>
            <button className="tool-button" type="button" onClick={onAddLowerThird}>
              <span>EV</span>
              {copy.lowerThird}
            </button>
          </section>
        ) : null}

        {activeTab === 'recent' ? (
          <section className="tool-section compact-section recent-section">
            <div className="section-heading">
              <p className="eyebrow">{copy.recent}</p>
              <h2>{copy.recent}</h2>
            </div>
            {recentElements.length === 0 ? (
              <div className="empty-panel">
                <p>{copy.noLayers}</p>
              </div>
            ) : (
              recentElements.map((element) => (
                <button
                  className="recent-button"
                  key={element.id}
                  type="button"
                  onClick={() => onSelectRecent(element.id)}
                >
                  <span>{element.name}</span>
                  <small>{element.type}</small>
                </button>
              ))
            )}
          </section>
        ) : null}
      </div>
    </aside>
  );
}
