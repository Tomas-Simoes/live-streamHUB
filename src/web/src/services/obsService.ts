export interface ObsConnectionSettings {
  host: string;
  port: number;
  password: string;
  sceneName: string;
  sourceName: string;
}

export interface ObsConnectionState {
  connected: boolean;
  mode: 'mock' | 'real';
  message: string;
}

const OBS_SETTINGS_KEY = 'live-streamhub.obs-settings.v1';

export function loadObsSettings(): ObsConnectionSettings {
  try {
    const stored = window.localStorage.getItem(OBS_SETTINGS_KEY);
    if (stored) return JSON.parse(stored) as ObsConnectionSettings;
  } catch {
    // Ignore invalid local settings.
  }

  return {
    host: 'localhost',
    port: 4455,
    password: '',
    sceneName: 'Live StreamHUB',
    sourceName: 'Live StreamHUB Overlay',
  };
}

export function saveObsSettings(settings: ObsConnectionSettings): void {
  window.localStorage.setItem(OBS_SETTINGS_KEY, JSON.stringify(settings));
}

export class ObsBrowserSourceService {
  private state: ObsConnectionState = {
    connected: false,
    mode: 'mock',
    message: 'OBS disconnected',
  };

  getState(): ObsConnectionState {
    return this.state;
  }

  async connect(settings: ObsConnectionSettings): Promise<ObsConnectionState> {
    saveObsSettings(settings);

    this.state = {
      connected: true,
      mode: 'mock',
      message: `Mock connected to ${settings.host}:${settings.port}`,
    };

    return this.state;
  }

  async disconnect(): Promise<ObsConnectionState> {
    this.state = {
      connected: false,
      mode: 'mock',
      message: 'OBS disconnected',
    };

    return this.state;
  }

  async createOrUpdateBrowserSource(
    settings: ObsConnectionSettings,
    overlayUrl: string,
  ): Promise<ObsConnectionState> {
    saveObsSettings(settings);

    this.state = {
      connected: true,
      mode: 'mock',
      message: `Mock Browser Source "${settings.sourceName}" points to ${overlayUrl}`,
    };

    return this.state;
  }
}

export const obsBrowserSourceService = new ObsBrowserSourceService();
