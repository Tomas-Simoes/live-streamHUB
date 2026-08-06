import { HubEditor } from './HubEditor';

interface EditorPageProps {
  hubId?: string;
}

export function EditorPage({ hubId }: EditorPageProps) {
  return <HubEditor hubId={hubId} />;
}
