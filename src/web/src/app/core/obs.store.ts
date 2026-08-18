import { Injectable } from "@angular/core";

const OBS_PASSWORD_STORAGE_KEY = "live-stream-hub.obs-password";

@Injectable({ providedIn: "root" })
export class OBSPasswordStore {
  private sessionPassword: string | null = null;

  getPassword() {
    return (
      this.sessionPassword ??
      window.localStorage.getItem(OBS_PASSWORD_STORAGE_KEY)
    );
  }

  saveForSession(password: string) {
    this.sessionPassword = password;
  }

  remember(password: string) {
    this.sessionPassword = password;
    window.localStorage.setItem(OBS_PASSWORD_STORAGE_KEY, password);
  }

  clearSession() {
    this.sessionPassword = null;
  }

  forgetRemembered() {
    window.localStorage.removeItem(OBS_PASSWORD_STORAGE_KEY);
  }
}
