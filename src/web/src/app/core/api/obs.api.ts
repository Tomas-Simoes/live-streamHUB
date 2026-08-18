import { Injectable } from "@angular/core";
import { env } from "src/env/env";
import OBSWebSocket from "obs-websocket-js";
import { Hub } from "src/app/shared/types/hub.types";
import { getHostAlignedUrl } from "./url.helpers";

@Injectable({ providedIn: "root" })
export class OBSApi {
  obs = new OBSWebSocket();

  private readonly baseUrl = `${env.obsUrl}`;

  async createConnection(password?: string): Promise<boolean> {
    return this.obs
      .connect(this.baseUrl, password)
      .then(() => {
        console.log("Connection established!");
        return true;
      })
      .catch((error) => {
        console.error("OBS connection failed:", error);
        return false;
      });
  }

  async exportHub(hub: Hub) {
    const userId = hub.user?.id;

    if (!userId) {
      throw new Error("Cannot export hub without owner id.");
    }

    const sceneName = `Live StreamHUB`;
    const inputName = `Live StreamHUB - Browser ${hub.hubName}`;
    const overlayUrl = `${this.getObsLocalServerUrl()}/overlay/${encodeURIComponent(userId)}/${encodeURIComponent(hub._id)}?exportedAt=${Date.now()}`;

    const inputSettings = {
      url: overlayUrl,
      width: 1920,
      height: 1080,
      fps: 60,
      shutdown: false,
      restart_when_active: false,
    };

    await this.setCurrentScene(sceneName);

    const { inputs } = await this.obs.call("GetInputList", {
      inputKind: "browser_source",
    });

    const inputExists = inputs.some((input) => input.inputName === inputName);
    if (inputExists) {
      await this.obs.call("SetInputSettings", {
        inputName,
        inputSettings,
        overlay: false,
      });
      return;
    }

    await this.obs.call("CreateInput", {
      sceneName,
      inputName,
      inputKind: "browser_source",
      inputSettings,
    });
  }

  async setCurrentScene(sceneName: string) {
    const { scenes } = await this.obs.call("GetSceneList");
    const sceneExists = scenes.some((scene) => scene.sceneName === sceneName);

    if (!sceneExists) {
      await this.obs.call("CreateScene", { sceneName });
    }

    await this.obs.call("SetCurrentProgramScene", { sceneName });
  }

  private getObsLocalServerUrl() {
    const explicitUrl = env.obsLocalServerUrl.trim();

    if (explicitUrl) {
      return explicitUrl.replace(/\/$/, "");
    }

    return getHostAlignedUrl(env.localServerUrl);
  }
}
