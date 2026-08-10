import { Injectable } from "@angular/core";
import { Hub } from "src/app/shared/types/hub.types";
import { env } from "src/env/env";

export type OBSConnectionResult = {
  connected: boolean;
  obsWebSocketVersion: string;
  negotiatedRpcVersion: number;
};

export type OBSVersionResponse = {
  obsVersion: string;
  obsWebSocketVersion: string;
  rpcVersion: number;
};

export type OBSCurrentProgramSceneResponse = {
  currentProgramSceneName: string;
  currentProgramSceneUuid: string;
};

type OBSMessage = {
  op: number;
  d: Record<string, any>;
};

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason?: unknown) => void;
};

type PendingIdentification = {
  password?: string;
  resolve: (value: OBSConnectionResult) => void;
  reject: (reason?: unknown) => void;
};

const OBS_EVENT_SUBSCRIPTIONS = 1 | 4 | 8 | 64;

@Injectable({ providedIn: "root" })
export class OBSApi {
  private readonly baseUrl = `${env.obsUrl}`;
  private socket: WebSocket | null = null;
  private identified = false;
  private requestCounter = 0;
  private connectionResult: OBSConnectionResult | null = null;
  private pendingIdentification: PendingIdentification | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private currentSceneChangedCallbacks = new Set<(sceneName: string) => void>();

  get isConnected() {
    return this.identified && this.socket?.readyState === WebSocket.OPEN;
  }

  async createConnection(password?: string): Promise<OBSConnectionResult> {
    if (this.isConnected) {
      return (
        this.connectionResult ?? {
          connected: true,
          obsWebSocketVersion: "unknown",
          negotiatedRpcVersion: 1,
        }
      );
    }

    this.disconnectSocket();

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.baseUrl, "obswebsocket.json");

      this.socket = socket;
      this.pendingIdentification = { password, resolve, reject };

      socket.addEventListener("message", (event) =>
        this.handleSocketMessage(event),
      );
      socket.addEventListener("close", (event) =>
        this.handleSocketClose(event),
      );
      socket.addEventListener("error", () => {
        reject(
          new Error(
            "Could not connect to OBS. Check that OBS is open and WebSocket is enabled.",
          ),
        );
      });
    });
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    this.disconnectSocket();
  }

  async exportHub(hub: Hub) {
    this.setCurrentScene(hub.hubName);
    
  }

  getVersion(): Promise<OBSVersionResponse> {
    return this.call<OBSVersionResponse>("GetVersion");
  }

  getCurrentScene(): Promise<OBSCurrentProgramSceneResponse> {
    return this.call<OBSCurrentProgramSceneResponse>("GetCurrentProgramScene");
  }

  setCurrentScene(sceneName: string): Promise<void> {
    return this.call<void>("SetCurrentProgramScene", { sceneName });
  }

  onCurrentSceneChanged(callback: (sceneName: string) => void): () => void {
    this.currentSceneChangedCallbacks.add(callback);

    return () => this.currentSceneChangedCallbacks.delete(callback);
  }

  private call<TResponse>(
    requestType: string,
    requestData?: object,
  ): Promise<TResponse> {
    if (!this.isConnected) {
      return Promise.reject(new Error("OBS is not connected."));
    }

    const requestId = `obs-request-${++this.requestCounter}`;

    this.send({
      op: 6,
      d: {
        requestType,
        requestId,
        requestData,
      },
    });

    return new Promise<TResponse>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
    });
  }

  private async handleSocketMessage(event: MessageEvent<string>) {
    const message = JSON.parse(event.data) as OBSMessage;

    if (message.op === 0) {
      await this.identify(message.d);
      return;
    }

    if (message.op === 2) {
      this.handleIdentified(message.d);
      return;
    }

    if (message.op === 5) {
      this.handleEvent(message.d);
      return;
    }

    if (message.op === 7) {
      this.handleRequestResponse(message.d);
    }
  }

  private async identify(hello: Record<string, any>) {
    const pendingIdentification = this.pendingIdentification;

    if (!pendingIdentification) {
      return;
    }

    const identifyData: Record<string, any> = {
      eventSubscriptions: OBS_EVENT_SUBSCRIPTIONS,
      rpcVersion: 1,
    };

    if (hello["authentication"]) {
      if (!pendingIdentification.password) {
        pendingIdentification.reject(
          new Error("OBS WebSocket requires a password."),
        );
        this.disconnectSocket();
        return;
      }

      identifyData["authentication"] = await this.createAuthenticationString(
        pendingIdentification.password,
        hello["authentication"]["salt"],
        hello["authentication"]["challenge"],
      );
    }

    this.connectionResult = {
      connected: false,
      obsWebSocketVersion: String(hello["obsWebSocketVersion"] ?? "unknown"),
      negotiatedRpcVersion: Number(hello["rpcVersion"] ?? 1),
    };

    this.send({ op: 1, d: identifyData });
  }

  private handleIdentified(data: Record<string, any>) {
    this.identified = true;

    const result: OBSConnectionResult = {
      connected: true,
      obsWebSocketVersion:
        this.connectionResult?.obsWebSocketVersion ?? "unknown",
      negotiatedRpcVersion: Number(data["negotiatedRpcVersion"] ?? 1),
    };

    this.connectionResult = result;
    this.pendingIdentification?.resolve(result);
    this.pendingIdentification = null;
  }

  private handleEvent(data: Record<string, any>) {
    if (data["eventType"] !== "CurrentProgramSceneChanged") {
      return;
    }

    const sceneName = data["eventData"]?.["sceneName"];

    if (typeof sceneName !== "string") {
      return;
    }

    this.currentSceneChangedCallbacks.forEach((callback) =>
      callback(sceneName),
    );
  }

  private handleRequestResponse(data: Record<string, any>) {
    const requestId = String(data["requestId"]);
    const pendingRequest = this.pendingRequests.get(requestId);

    if (!pendingRequest) {
      return;
    }

    this.pendingRequests.delete(requestId);

    if (data["requestStatus"]?.["result"]) {
      pendingRequest.resolve(data["responseData"]);
      return;
    }

    pendingRequest.reject(
      new Error(data["requestStatus"]?.["comment"] ?? "OBS request failed."),
    );
  }

  private handleSocketClose(event: CloseEvent) {
    this.identified = false;

    const error = new Error(event.reason || "OBS WebSocket connection closed.");

    this.pendingIdentification?.reject(error);
    this.pendingIdentification = null;
    this.pendingRequests.forEach((request) => request.reject(error));
    this.pendingRequests.clear();
  }

  private send(message: OBSMessage) {
    this.socket?.send(JSON.stringify(message));
  }

  private disconnectSocket() {
    this.identified = false;
    this.pendingIdentification = null;
    this.pendingRequests.clear();

    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      this.socket.close();
    }

    this.socket = null;
  }

  private async createAuthenticationString(
    password: string,
    salt: string,
    challenge: string,
  ) {
    const secret = await this.sha256Base64(password + salt);

    return this.sha256Base64(secret + challenge);
  }

  private async sha256Base64(value: string) {
    const bytes = new TextEncoder().encode(value);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", bytes);
    const hashBytes = new Uint8Array(hashBuffer);

    return window.btoa(String.fromCharCode(...hashBytes));
  }
}
