import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { HubResponse } from "src/app/shared/types/hub.types";
import { env } from "src/env/env";

@Injectable({ providedIn: "root" })
export class OverlayApi {
  constructor(private http: HttpClient) {}

  getHub(userId: string, hubId: string) {
    return this.http.get<HubResponse>(
      `${env.localServerUrl}/overlay/${encodeURIComponent(userId)}/${encodeURIComponent(hubId)}/config`,
    );
  }
}
