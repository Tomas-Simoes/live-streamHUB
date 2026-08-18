// src/web/src/app/core/api/game-data-live.api.ts
import { Injectable, signal } from "@angular/core";
import { env } from "src/env/env";

@Injectable({ providedIn: "root" })
export class GameDataApi {
  readonly state = signal<any | null>(null);
  private socket?: WebSocket;

  connect() {
    this.socket = new WebSocket(env.localGameDataWsUrl);

    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "game-state") {
        this.state.set(message.data);
      }
    };

    this.socket.onclose = () => {
      setTimeout(() => this.connect(), 1000);
    };
  }

  disconnect() {
    this.socket?.close();
  }
}
