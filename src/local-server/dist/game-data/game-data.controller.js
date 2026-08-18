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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameDataController = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const game_data_service_1 = require("./game-data.service");
let GameDataController = class GameDataController {
    gameDataService;
    constructor(gameDataService) {
        this.gameDataService = gameDataService;
    }
    getState() {
        return this.gameDataService.getState();
    }
    getBindings() {
        return this.gameDataService.getBindings();
    }
    live() {
        return (0, rxjs_1.interval)(1000).pipe((0, rxjs_1.map)(() => ({
            data: this.gameDataService.getState(),
        })));
    }
    ingest(payload) {
        return this.gameDataService.ingest(payload);
    }
};
exports.GameDataController = GameDataController;
__decorate([
    (0, common_1.Get)('state'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], GameDataController.prototype, "getState", null);
__decorate([
    (0, common_1.Get)('bindings'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], GameDataController.prototype, "getBindings", null);
__decorate([
    (0, common_1.Sse)('live'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", rxjs_1.Observable)
], GameDataController.prototype, "live", null);
__decorate([
    (0, common_1.Post)('ingest'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GameDataController.prototype, "ingest", null);
exports.GameDataController = GameDataController = __decorate([
    (0, common_1.Controller)('game-data'),
    __metadata("design:paramtypes", [game_data_service_1.GameDataService])
], GameDataController);
//# sourceMappingURL=game-data.controller.js.map