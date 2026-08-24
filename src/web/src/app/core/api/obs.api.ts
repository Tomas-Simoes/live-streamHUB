import { Injectable } from "@angular/core";
import { env } from "src/env/env";
import OBSWebSocket from "obs-websocket-js";
import { Hub } from "src/app/shared/types/hub.types";
import { getObsSceneName } from "../helper/obs-layer.helpers";

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
    const sceneName = getObsSceneName(hub);

    await this.setCurrentScene(sceneName);
  }

  async setCurrentScene(sceneName: string) {
    const { scenes } = await this.obs.call("GetSceneList");
    const sceneExists = scenes.some((scene) => scene.sceneName === sceneName);

    if (!sceneExists) {
      await this.obs.call("CreateScene", { sceneName });
    }

    await this.obs.call("SetCurrentProgramScene", { sceneName });
  }
}
