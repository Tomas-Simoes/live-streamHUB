import { OverlayService } from './overlay.service';
export declare class OverlayController {
    private readonly overlay;
    private readonly logger;
    constructor(overlay: OverlayService);
    getHubConfig(params: {
        userId: string;
        hubId: string;
    }): Promise<Record<string, any>>;
    getOverlayPage(params: {
        userId: string;
        hubId: string;
    }): string;
}
