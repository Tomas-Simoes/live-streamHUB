import { useState, type Dispatch, type SetStateAction } from 'react';
import type { EditorLanguage } from '../i18n/editorText';
import { login, register } from '../services/authService';

type AuthMode = 'login' | 'register';

interface AuthPageProps {
  mode: AuthMode;
  language: EditorLanguage;
  onLanguageChange: Dispatch<SetStateAction<EditorLanguage>>;
}

const authCopy = {
  en: {
    loginTitle: 'Welcome back to the booth.',
    registerTitle: 'Create your broadcast desk.',
    loginText: 'Sign in to manage your saved Hub layouts and OBS-ready overlays.',
    registerText: 'Create a studio account to save layouts to the backend and continue across sessions.',
    email: 'Email',
    password: 'Password',
    username: 'Studio name',
    login: 'Login',
    register: 'Register',
    noAccount: 'Need an account?',
    hasAccount: 'Already have one?',
    goRegister: 'Register',
    goLogin: 'Login',
    openEditor: 'Open editor',
    layouts: 'My layouts',
    submitted: 'Authenticated. Opening your layouts.',
    failed: 'Authentication failed.',
  },
  pt: {
    loginTitle: 'Bem-vindo de volta a mesa.',
    registerTitle: 'Cria a tua mesa de broadcast.',
    loginText: 'Entra para gerir os teus layouts de Hub guardados e overlays prontos para OBS.',
    registerText: 'Cria uma conta de estudio para guardar layouts no backend e continuar noutras sessoes.',
    email: 'Email',
    password: 'Password',
    username: 'Nome do estudio',
    login: 'Login',
    register: 'Registar',
    noAccount: 'Precisas de conta?',
    hasAccount: 'Ja tens conta?',
    goRegister: 'Registar',
    goLogin: 'Login',
    openEditor: 'Abrir editor',
    layouts: 'Os meus layouts',
    submitted: 'Autenticado. A abrir os teus layouts.',
    failed: 'A autenticacao falhou.',
  },
} as const;

export function AuthPage({ mode, language, onLanguageChange }: AuthPageProps) {
  const copy = authCopy[language];
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegister = mode === 'register';

  return (
    <main className="site-shell auth-page">
      <nav className="site-nav">
        <a className="site-logo" href="/">
          Marquee
        </a>
        <div className="site-nav-links">
          <a href="/layouts">{copy.layouts}</a>
          <a href="/editor">{copy.openEditor}</a>
          <a href={isRegister ? '/login' : '/register'}>{isRegister ? copy.goLogin : copy.goRegister}</a>
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

      <section className="auth-layout">
        <div className="auth-poster">
          <p className="eyebrow">{isRegister ? copy.register : copy.login}</p>
          <h1>{isRegister ? copy.registerTitle : copy.loginTitle}</h1>
          <p>{isRegister ? copy.registerText : copy.loginText}</p>
        </div>

        <form
          className="auth-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setIsSubmitting(true);
            setMessage('');

            const formData = new FormData(event.currentTarget);
            const email = String(formData.get('email') || '');
            const password = String(formData.get('password') || '');
            const username = String(formData.get('username') || '');

            try {
              if (isRegister) {
                await register({ email, password, username });
              } else {
                await login({ email, password });
              }

              setMessage(copy.submitted);
              window.location.href = '/layouts';
            } catch (error) {
              setMessage(error instanceof Error ? error.message : copy.failed);
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          {isRegister ? (
            <label>
              {copy.username}
            <input name="username" autoComplete="organization" required minLength={3} />
            </label>
          ) : null}
          <label>
            {copy.email}
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            {copy.password}
            <input
              name="password"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
              minLength={8}
            />
          </label>
          <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? copy.submitted : isRegister ? copy.register : copy.login}
          </button>
          {message ? <p className="auth-message">{message}</p> : null}
          <p className="auth-alt">
            {isRegister ? copy.hasAccount : copy.noAccount}{' '}
            <a href={isRegister ? '/login' : '/register'}>{isRegister ? copy.goLogin : copy.goRegister}</a>
          </p>
        </form>
      </section>
    </main>
  );
}
