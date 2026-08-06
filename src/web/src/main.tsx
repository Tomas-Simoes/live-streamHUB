import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

export default function triggerMain() {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Failed to load root element.');

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
