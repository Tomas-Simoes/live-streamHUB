import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { CreateHubRequest, HubResponse, UpdateHubRequest } from "src/app/shared/types/hub.types";
import { getBackendApiUrl } from "./url.helpers";

@Injectable({ providedIn: 'root' })
export class HubsApi {
    private readonly baseUrl = `${getBackendApiUrl()}/hub`;
    private readonly httpOptions = { withCredentials: true };


    constructor(private http: HttpClient) { }

    getMyHubs() {
        return this.http.get<HubResponse[]>(`${this.baseUrl}/mine`, this.httpOptions);
    }

    createHub(data: CreateHubRequest) {
        return this.http.post<HubResponse>(`${this.baseUrl}/create`, data, this.httpOptions);
    }

    updateHub(hubId: string, changes: UpdateHubRequest) {
        return this.http.patch<HubResponse>(`${this.baseUrl}/update/${hubId}`, changes, this.httpOptions);
    }

    deleteHub(hubId: string) {
        return this.http.delete<HubResponse>(`${this.baseUrl}/delete/${hubId}`, this.httpOptions);
    }
}
