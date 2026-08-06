import type { EditorCopy } from '../../i18n/editorText';

interface EditorStatusBarProps {
  dataConnected: boolean;
  overlayUrl: string;
  copy: EditorCopy;
}

export function EditorStatusBar({ dataConnected, overlayUrl, copy }: EditorStatusBarProps) {
  return (
    <footer className="status-footer">
      <span>{copy.zoom}</span>
      <span>{copy.resolution}</span>
      <span>{dataConnected ? copy.dataBackend : copy.dataLocal}</span>
      <span>{copy.keyboardHint}</span>
      <span>
        {copy.overlay}: {overlayUrl}
      </span>
    </footer>
  );
}
