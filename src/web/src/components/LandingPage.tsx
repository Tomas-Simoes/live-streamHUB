import { useState, type Dispatch, type SetStateAction } from 'react';
import type { EditorLanguage } from '../i18n/editorText';

interface LandingPageProps {
  language: EditorLanguage;
  onLanguageChange: Dispatch<SetStateAction<EditorLanguage>>;
}

const landingCopy = {
  en: {
    eyebrow: 'broadcast overlays for competitive games',
    headline: 'Design the show before the match begins.',
    intro:
      'Marquee is a visual studio for esports stream HUBs: build scorebugs, lower thirds, data widgets and OBS-ready overlays from one crafted workspace.',
    openEditor: 'Open editor',
    layouts: 'Layouts',
    login: 'Login',
    register: 'Register',
    preview: 'Live preview',
    browserSource: 'OBS Browser Source',
    syncedData: 'Mock data stream',
    section: 'Production flow',
    cards: [
      ['Build', 'Compose text, images, scoreboards and game-data widgets on a 1920x1080 canvas.'],
      ['Bind', 'Connect widgets to bindings like game.time, blueTeam.gold and currentEvent.'],
      ['Broadcast', 'Send the clean overlay URL to OBS and keep the editor separate from the final render.'],
    ],
    authTitle: 'Start with a studio account',
    authText: 'Authentication screens are ready for the product flow; real auth can be connected later.',
  },
  pt: {
    eyebrow: 'overlays de broadcast para competicoes online',
    headline: 'Desenha o espetaculo antes do jogo comecar.',
    intro:
      'Marquee e um estudio visual para HUBs de esports: cria scorebugs, lower thirds, widgets de dados e overlays prontos para OBS num so workspace.',
    openEditor: 'Abrir editor',
    layouts: 'Layouts',
    login: 'Login',
    register: 'Registar',
    preview: 'Preview live',
    browserSource: 'Browser Source OBS',
    syncedData: 'Stream mock',
    section: 'Fluxo de producao',
    cards: [
      ['Construir', 'Compoe texto, imagens, scoreboards e widgets de dados numa canvas 1920x1080.'],
      ['Ligar', 'Liga widgets a bindings como game.time, blueTeam.gold e currentEvent.'],
      ['Transmitir', 'Envia a URL limpa do overlay para o OBS e mantem o editor separado do render final.'],
    ],
    authTitle: 'Comeca com uma conta de estudio',
    authText: 'As telas de autenticacao ficam prontas para o fluxo do produto; a auth real pode ser ligada depois.',
  },
} as const;

export function LandingPage({ language, onLanguageChange }: LandingPageProps) {
  const [brandName, setBrandName] = useState<'Marquee' | 'Live Hub'>('Marquee');
  const copy = landingCopy[language];

  return (
    <main className="site-shell landing-page">
      <nav className="site-nav">
        <button
          className="site-logo"
          type="button"
          onClick={() => setBrandName((current) => (current === 'Marquee' ? 'Live Hub' : 'Marquee'))}
        >
          {brandName}
        </button>
        <div className="site-nav-links">
          <a href="/editor">{copy.openEditor}</a>
          <a href="/layouts">{copy.layouts}</a>
          <a href="/login">{copy.login}</a>
          <a href="/register">{copy.register}</a>
          <div className="language-switch paper-switch" aria-label="Language">
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
        </div>
      </nav>

      <section className="landing-hero">
        <div className="hero-copy">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.headline}</h1>
          <p>{copy.intro}</p>
          <div className="hero-actions">
            <a className="primary-link" href="/editor">
              {copy.openEditor}
            </a>
            <a className="secondary-link" href="/register">
              {copy.register}
            </a>
            <a className="secondary-link" href="/layouts">
              {copy.layouts}
            </a>
          </div>
        </div>

        <div className="hero-board" aria-label="Marquee product preview">
          <div className="hero-board-top">
            <span>{copy.preview}</span>
            <strong>1920 x 1080</strong>
          </div>
          <div className="hero-canvas-preview">
            <div className="scorebug scorebug-blue">BLUE 12</div>
            <div className="scorebug scorebug-red">RED 9</div>
            <div className="timeplate">17:42</div>
            <div className="event-strip">Blue secured the dragon</div>
          </div>
          <div className="hero-board-bottom">
            <span>{copy.browserSource}</span>
            <span>{copy.syncedData}</span>
          </div>
        </div>
      </section>

      <section className="landing-band">
        <p className="eyebrow">{copy.section}</p>
        <div className="feature-row">
          {copy.cards.map(([title, text]) => (
            <article className="feature-card" key={title}>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="auth-callout">
        <div>
          <p className="eyebrow">{copy.register}</p>
          <h2>{copy.authTitle}</h2>
          <p>{copy.authText}</p>
        </div>
        <div className="hero-actions">
          <a className="secondary-link" href="/login">
            {copy.login}
          </a>
          <a className="primary-link" href="/register">
            {copy.register}
          </a>
        </div>
      </section>
    </main>
  );
}
