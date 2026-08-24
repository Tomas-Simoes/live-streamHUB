class HubApi {
    constructor(options) {
        this.baseUrl = (options && options.baseUrl) || "http://127.0.0.1:3000";
    }

    async getHubByOwner(userId, hubId) {
        const url = `${this.baseUrl}/hub/owner/${encodeURIComponent(userId)}/${encodeURIComponent(hubId)}`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`Hub lookup failed with HTTP ${response.status}.`);
        }

        return response.json();
    }
}
