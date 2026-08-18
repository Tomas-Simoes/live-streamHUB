import "reflect-metadata";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import WebSocket from "ws";
import { AppModule } from "./app.module";
import { GameDataService } from "./game-data/game-data.service";

export type LocalServerOptions = {
  port?: number | string;
  host?: string;
  overlayDistDir?: string;
};

export type LocalServerHandle = {
  app: NestExpressApplication;
  close: () => Promise<void>;
};

export async function startLocalServer(
  options: LocalServerOptions = {},
): Promise<LocalServerHandle> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const allowedOrigins = (
    process.env.LOCAL_CORS_ORIGIN ||
    "http://localhost:4200,http://127.0.0.1:4200"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.use(helmet({ contentSecurityPolicy: false }));
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

function serveOverlayApp(
  app: NestExpressApplication,
  configuredOverlayDistDir?: string,
) {
  const overlayDistDir =
    configuredOverlayDistDir ||
    process.env.LOCAL_OVERLAY_DIST_DIR ||
    join(process.cwd(), "../web/dist/browser");
  const overlayIndexPath = join(overlayDistDir, "index.html");

  if (!existsSync(overlayIndexPath)) {
    return;
  }

  app.useStaticAssets(overlayDistDir);
  app.use((request, response, next) => {
    if (
      request.method !== "GET" ||
      request.path.startsWith("/game-data") ||
      request.path.startsWith("/overlay") ||
      request.path.startsWith("/api/docs")
    ) {
      next();
      return;
    }

    response.sendFile(overlayIndexPath);
  });
}

function initGameDataWebsocket(app: NestExpressApplication) {
  const gameDataService = app.get(GameDataService);
  const wss = new WebSocket.Server({
    server: app.getHttpServer(),
    path: "/game-data/ws",
  });

  wss.on("connection", (socket) => {
    const subscription = gameDataService.updates$.subscribe((state) => {
      if (socket.readyState !== WebSocket.OPEN) return;

      socket.send(
        JSON.stringify({
          type: "game-state",
          data: state,
        }),
      );
    });

    socket.on("close", () => {
      subscription.unsubscribe();
    });
  });

  return wss;
}
