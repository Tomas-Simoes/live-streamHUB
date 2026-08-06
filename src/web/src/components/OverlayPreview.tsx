import { OverlayPage } from './OverlayPage';

interface OverlayPreviewProps {
  hubId: string;
}

export function OverlayPreview({ hubId }: OverlayPreviewProps) {
  return <OverlayPage hubId={hubId} />;
}
