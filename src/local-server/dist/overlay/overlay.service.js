"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var OverlayService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverlayService = void 0;
const common_1 = require("@nestjs/common");
let OverlayService = OverlayService_1 = class OverlayService {
    logger = new common_1.Logger(OverlayService_1.name);
    backendUrl = (process.env.HUB_BACKEND_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
    async getHubConfig(userId, hubId) {
        const backendHubUrl = `${this.backendUrl}/hub/owner/${encodeURIComponent(userId)}/${encodeURIComponent(hubId)}`;
        this.logger.log(`Fetching hub config from backend: ${backendHubUrl}`);
        let response;
        try {
            response = await fetch(backendHubUrl);
        }
        catch (error) {
            this.logger.error(`Backend unreachable while loading overlay config userId=${userId} hubId=${hubId}: ${this.getErrorMessage(error)}`);
            throw new common_1.BadGatewayException(`Backend is unreachable at ${this.backendUrl}`);
        }
        this.logger.log(`Backend hub config response userId=${userId} hubId=${hubId} status=${response.status}`);
        if (response.status === 404) {
            throw new common_1.NotFoundException(`Overlay hub ${hubId} not found`);
        }
        if (!response.ok) {
            const body = await response.text();
            this.logger.error(`Backend failed while loading overlay config userId=${userId} hubId=${hubId} status=${response.status} body=${body}`);
            throw new common_1.BadGatewayException(`Could not load hub from backend: ${response.status}`);
        }
        const hub = (await response.json());
        const layers = Array.isArray(hub?.['layout']?.['layers'])
            ? hub['layout']['layers'].length
            : 0;
        this.logger.log(`Loaded hub config hubId=${hubId} hubName=${String(hub?.['hubName'] ?? '')} layers=${layers}`);
        return hub;
    }
    getErrorMessage(error) {
        return error instanceof Error ? error.message : String(error);
    }
};
exports.OverlayService = OverlayService;
exports.OverlayService = OverlayService = OverlayService_1 = __decorate([
    (0, common_1.Injectable)()
], OverlayService);
//# sourceMappingURL=overlay.service.js.map