import type { EditorCopy } from '../../i18n/editorText';
import type { DataBindingDefinition } from '../../types/hub';

interface DataWidgetLibraryProps {
  groupedBindings: Record<string, DataBindingDefinition[]>;
  copy: EditorCopy;
  onAddWidget: (bindingKey: string) => void;
}

export function DataWidgetLibrary({ groupedBindings, copy, onAddWidget }: DataWidgetLibraryProps) {
  return (
    <section className="tool-section widget-library">
      <div className="section-heading">
        <p className="eyebrow">{copy.gameData}</p>
        <h2>{copy.dataWidgets}</h2>
      </div>
      {Object.entries(groupedBindings).map(([group, bindings]) => (
        <div className="binding-group" key={group}>
          <h3>{group}</h3>
          {bindings.map((binding) => (
            <button
              className="binding-button"
              key={binding.key}
              type="button"
              onClick={() => onAddWidget(binding.key)}
            >
              <span>{binding.label}</span>
              <small>{binding.key}</small>
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}
