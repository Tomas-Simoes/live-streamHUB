"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var OverlayController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverlayController = void 0;
const common_1 = require("@nestjs/common");
const overlay_page_1 = require("./overlay-page");
const overlay_service_1 = require("./overlay.service");
let OverlayController = OverlayController_1 = class OverlayController {
    overlay;
    logger = new common_1.Logger(OverlayController_1.name);
    constructor(overlay) {
        this.overlay = overlay;
    }
    getHubConfig(params) {
        this.logger.log(`Config requested userId=${params.userId} hubId=${params.hubId}`);
        return this.overlay.getHubConfig(params.userId, params.hubId);
    }
    getOverlayPage(params) {
        this.logger.log(`Page requested userId=${params.userId} hubId=${params.hubId}`);
        return (0, overlay_page_1.renderOverlayPage)();
    }
};
exports.OverlayController = OverlayController;
__decorate([
    (0, common_1.Get)(':userId/:hubId/config'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OverlayController.prototype, "getHubConfig", null);
__decorate([
    (0, common_1.Get)(':userId/:hubId'),
    (0, common_1.Header)('Content-Type', 'text/html; charset=utf-8'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OverlayController.prototype, "getOverlayPage", null);
exports.OverlayController = OverlayController = OverlayController_1 = __decorate([
    (0, common_1.Controller)('overlay'),
    __metadata("design:paramtypes", [overlay_service_1.OverlayService])
], OverlayController);
//# sourceMappingURL=overlay.controller.js.map