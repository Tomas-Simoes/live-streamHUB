"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startLocalServer = startLocalServer;
require("reflect-metadata");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const helmet_1 = __importDefault(require("helmet"));
const ws_1 = __importDefault(require("ws"));
const app_module_1 = require("./app.module");
const game_data_service_1 = require("./game-data/game-data.service");
async function startLocalServer(options = {}) {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useGlobalPipes(new common_1.ValidationPipe({
        transform: true,
        forbidNonWhitelisted: true,
    }));
    const allowedOrigins = (process.env.LOCAL_CORS_ORIGIN ||
        "http://localhost:4200,http://127.0.0.1:4200")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    app.enableCors({
        origin: allowedOrigins,
        credentials: true,
    });
    app.use((0, helmet_1.default)({ contentSecurityPolicy: false }));
    serveOverlayApp(app, options.overlayDistDir);
    const wss = initGameDataWebsocket(app);
    const port = options.port ?? process.env.LOCAL_SERVER_PORT ?? 3001;
    const host = options.host ?? process.env.LOCAL_SERVER_HOST ?? "0.0.0.0";
    await app.listen(port, host);
    return {
        app,
        close: async () => {
            wss.close();
            await app.close();
        },
    };
}
function serveOverlayApp(app, configuredOverlayDistDir) {
    const overlayDistDir = configuredOverlayDistDir ||
        process.env.LOCAL_OVERLAY_DIST_DIR ||
        (0, node_path_1.join)(process.cwd(), "../web/dist/browser");
    const overlayIndexPath = (0, node_path_1.join)(overlayDistDir, "index.html");
    if (!(0, node_fs_1.existsSync)(overlayIndexPath)) {
        return;
    }
    app.useStaticAssets(overlayDistDir);
    app.use((request, response, next) => {
        if (request.method !== "GET" ||
            request.path.startsWith("/game-data") ||
            request.path.startsWith("/overlay") ||
            request.path.startsWith("/api/docs")) {
            next();
            return;
        }
        response.sendFile(overlayIndexPath);
    });
}
function initGameDataWebsocket(app) {
    const gameDataService = app.get(game_data_service_1.GameDataService);
    const wss = new ws_1.default.Server({
        server: app.getHttpServer(),
        path: "/game-data/ws",
    });
    wss.on("connection", (socket) => {
        const subscription = gameDataService.updates$.subscribe((state) => {
            if (socket.readyState !== ws_1.default.OPEN)
                return;
            socket.send(JSON.stringify({
                type: "game-state",
                data: state,
            }));
        });
        socket.on("close", () => {
            subscription.unsubscribe();
        });
    });
    return wss;
}
//# sourceMappingURL=server.js.map