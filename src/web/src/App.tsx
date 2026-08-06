import './App.css';
import { useState } from 'react';
import { AuthPage } from './components/AuthPage';
import { EditorPage } from './components/EditorPage';
import { LandingPage } from './components/LandingPage';
import { LayoutGalleryPage } from './components/LayoutGalleryPage';
import { LayoutPreviewPage } from './components/LayoutPreviewPage';
import { OverlayPreview } from './components/OverlayPreview';
import type { EditorLanguage } from './i18n/editorText';

function getOverlayHubId(pathname: string): string | undefined {
  const match = pathname.match(/^\/overlay\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

function getEditorHubId(pathname: string): string | undefined {
  const match = pathname.match(/^\/editor\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

function getLayoutHubId(pathname: string): string | undefined {
  const match = pathname.match(/^\/layouts\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

function App() {
  const pathname = window.location.pathname;
  const overlayHubId = getOverlayHubId(pathname);
  const editorHubId = getEditorHubId(pathname);
  const layoutHubId = getLayoutHubId(pathname);
  const [language, setLanguage] = useState<EditorLanguage>(() => {
    const stored = window.localStorage.getItem('live-streamhub.language');
    return stored === 'pt' ? 'pt' : 'en';
  });

  const setStoredLanguage = (nextLanguage: EditorLanguage | ((current: EditorLanguage) => EditorLanguage)) => {
    setLanguage((current) => {
      const resolved = typeof nextLanguage === 'function' ? nextLanguage(current) : nextLanguage;
      window.localStorage.setItem('live-streamhub.language', resolved);
      return resolved;
    });
  };

  if (overlayHubId) {
    return <OverlayPreview hubId={overlayHubId} />;
  }

  if (pathname === '/editor') {
    return <EditorPage />;
  }

  if (editorHubId) {
    return <EditorPage hubId={editorHubId} />;
  }

  if (pathname === '/layouts') {
    return <LayoutGalleryPage />;
  }

  if (layoutHubId) {
    return <LayoutPreviewPage hubId={layoutHubId} />;
  }

  if (pathname === '/login') {
    return <AuthPage mode="login" language={language} onLanguageChange={setStoredLanguage} />;
  }

  if (pathname === '/register') {
    return <AuthPage mode="register" language={language} onLanguageChange={setStoredLanguage} />;
  }

  return <LandingPage language={language} onLanguageChange={setStoredLanguage} />;
}

export default App;
