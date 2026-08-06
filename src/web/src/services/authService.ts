const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const AUTH_STORAGE_KEY = 'live-streamhub.auth.v1';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  user?: AuthUser;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  username: string;
}

function readStoredSession(): AuthSession | undefined {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : undefined;
  } catch {
    return undefined;
  }
}

function writeStoredSession(session: AuthSession): AuthSession {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  return session;
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export function getAuthSession(): AuthSession | undefined {
  return readStoredSession();
}

export function getAccessToken(): string | undefined {
  return readStoredSession()?.accessToken;
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const tokens = await requestJson<AuthSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const session = writeStoredSession(tokens);

  try {
    const user = await getMe();
    return writeStoredSession({ ...session, user });
  } catch {
    return session;
  }
}

export async function register(input: RegisterInput): Promise<AuthSession> {
  await requestJson<AuthUser>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  return login({
    email: input.email,
    password: input.password,
  });
}

export async function getMe(): Promise<AuthUser> {
  return requestJson<AuthUser>('/auth/me', {
    method: 'GET',
    headers: getAuthHeaders(),
  });
}

export function logout(): void {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
