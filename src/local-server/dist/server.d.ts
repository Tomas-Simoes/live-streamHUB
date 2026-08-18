import "reflect-metadata";
import { NestExpressApplication } from "@nestjs/platform-express";
export type LocalServerOptions = {
    port?: number | string;
    host?: string;
    overlayDistDir?: string;
};
export type LocalServerHandle = {
    app: NestExpressApplication;
    close: () => Promise<void>;
};
export declare function startLocalServer(options?: LocalServerOptions): Promise<LocalServerHandle>;
