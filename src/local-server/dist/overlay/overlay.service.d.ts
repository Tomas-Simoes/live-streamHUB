export declare class OverlayService {
    private readonly logger;
    private readonly backendUrl;
    getHubConfig(userId: string, hubId: string): Promise<Record<string, any>>;
    private getErrorMessage;
}
