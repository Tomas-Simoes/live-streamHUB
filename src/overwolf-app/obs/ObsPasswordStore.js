const OBS_PASSWORD_STORAGE_KEY = "live-stream-hub.obs-password";

class ObsPasswordStore {
    constructor() {
        this.sessionPassword = null;
    }

    getPassword() {
        return this.sessionPassword || window.localStorage.getItem(OBS_PASSWORD_STORAGE_KEY);
    }

    saveForSession(password) {
        this.sessionPassword = password;
    }

    remember(password) {
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
