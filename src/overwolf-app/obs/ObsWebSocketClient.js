class ObsWebSocketClient {
    constructor(options) {
        this.url = (options && options.url) || "ws://127.0.0.1:4455";
        this.password = "";
        this.socket = null;
        this.identified = false;
        this.connectPromise = null;
        this.pendingRequests = new Map();
        this.nextRequestId = 1;
        this.requestTimeoutMs = 5000;
    }

    async connect(options) {
        if (options && options.url) {
            this.url = options.url;
        }
        if (options && "password" in options) {
            this.password = options.password || "";
        }
        if (this.isReady()) {
            return;
        }
        if (!this.connectPromise) {
            this.connectPromise = this.openSocket();
        }

        try {
            await this.connectPromise;
        }
        finally {
            this.connectPromise = null;
        }
    }

    async call(requestType, requestData) {
        if (!this.isReady()) {
            await this.connect();
        }

        const requestId = String(this.nextRequestId++);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`OBS request timed out: ${requestType}.`));
            }, this.requestTimeoutMs);

            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeout,
                requestType
            });

            try {
                this.socket.send(JSON.stringify({
                    op: 6,
                    d: {
                        requestType,
                        requestId,
                        requestData: requestData || {}
                    }
                }));
            }
            catch (error) {
                clearTimeout(timeout);
                this.pendingRequests.delete(requestId);
                reject(error);
            }
        });
    }

    isReady() {
        return Boolean(
            this.socket &&
            this.socket.readyState === WebSocket.OPEN &&
            this.identified
        );
    }

    async openSocket() {
        this.closeSocket();
        this.identified = false;

        return new Promise((resolve, reject) => {
            let settled = false;
            const socket = new WebSocket(this.url);
            const timeout = setTimeout(() => {
                rejectHandshake(new Error("Timed out while connecting to OBS."));
                socket.close();
            }, this.requestTimeoutMs);

            this.socket = socket;

            const rejectHandshake = (error) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timeout);
                this.identified = false;
                reject(error);
            };

            const resolveHandshake = () => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timeout);
                this.identified = true;
                resolve();
            };

            socket.onerror = () => {
                rejectHandshake(new Error("Could not connect to OBS WebSocket."));
            };

            socket.onclose = (event) => {
                if (this.socket !== socket) {
                    return;
                }
                const closeError = getCloseError(event);
                this.identified = false;
                this.rejectPendingRequests(closeError);
                rejectHandshake(closeError);
            };

            socket.onmessage = (event) => {
                void this.handleMessage(event, resolveHandshake, rejectHandshake);
            };
        });
    }

    closeSocket() {
        if (!this.socket) {
            return;
        }
        const socket = this.socket;
        this.socket = null;
        socket.onopen = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.onmessage = null;
        if (
            socket.readyState === WebSocket.OPEN ||
            socket.readyState === WebSocket.CONNECTING
        ) {
            socket.close();
        }
    }

    async handleMessage(event, resolveHandshake, rejectHandshake) {
        let message;

        try {
            message = JSON.parse(event.data);
        }
        catch {
            return;
        }

        if (message.op === 0) {
            try {
                await this.identify(message.d || {});
            }
            catch (error) {
                rejectHandshake(error);
                this.closeSocket();
            }
            return;
        }

        if (message.op === 2) {
            resolveHandshake();
            return;
        }

        if (message.op === 7) {
            this.handleRequestResponse(message.d || {});
        }
    }

    async identify(hello) {
        const rpcVersion = Math.min(Number(hello.rpcVersion) || 1, 1);
        const identifyData = { rpcVersion };

        if (hello.authentication) {
            if (!this.password) {
                throw new Error("OBS requires a WebSocket password.");
            }

            identifyData.authentication = await this.createAuthentication(
                this.password,
                hello.authentication.salt,
                hello.authentication.challenge
            );
        }

        this.socket.send(JSON.stringify({
            op: 1,
            d: identifyData
        }));
    }

    async createAuthentication(password, salt, challenge) {
        const secret = await this.sha256Base64(`${password}${salt}`);
        return this.sha256Base64(`${secret}${challenge}`);
    }

    async sha256Base64(value) {
        if (!window.crypto || !window.crypto.subtle) {
            throw new Error("OBS password authentication needs browser crypto support.");
        }

        const bytes = new TextEncoder().encode(value);
        const hash = await window.crypto.subtle.digest("SHA-256", bytes);
        const hashBytes = Array.from(new Uint8Array(hash));
        const binary = hashBytes.map((byte) => String.fromCharCode(byte)).join("");

        return window.btoa(binary);
    }

    handleRequestResponse(response) {
        const pending = this.pendingRequests.get(response.requestId);

        if (!pending) {
            return;
        }

        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.requestId);

        if (response.requestStatus && response.requestStatus.result) {
            pending.resolve(response.responseData || {});
            return;
        }

        const comment = response.requestStatus && response.requestStatus.comment;
        pending.reject(new Error(comment || `OBS request failed: ${pending.requestType}.`));
    }

    rejectPendingRequests(error) {
        this.pendingRequests.forEach((pending) => {
            clearTimeout(pending.timeout);
            pending.reject(error);
        });
        this.pendingRequests.clear();
    }
}

function getCloseError(event) {
    const reason = event && event.reason ? ` ${event.reason}` : "";
    const code = event && event.code ? ` (${event.code})` : "";

    if (event && event.code === 4005) {
        return new Error("OBS WebSocket authentication failed. Check the password.");
    }

    return new Error(`OBS WebSocket connection closed${code}.${reason}`.trim());
}
