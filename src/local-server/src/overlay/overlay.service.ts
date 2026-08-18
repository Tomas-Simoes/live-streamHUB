import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class OverlayService {
  private readonly logger = new Logger(OverlayService.name);

  private readonly backendUrl = (
    process.env.HUB_BACKEND_URL || 'http://127.0.0.1:3000'
  ).replace(/\/$/, '');

  async getHubConfig(userId: string, hubId: string) {
    const backendHubUrl = `${this.backendUrl}/hub/owner/${encodeURIComponent(userId)}/${encodeURIComponent(hubId)}`;

    this.logger.log(`Fetching hub config from backend: ${backendHubUrl}`);

    let response: Response;

    try {
      response = await fetch(backendHubUrl);
    } catch (error) {
      this.logger.error(
        `Backend unreachable while loading overlay config userId=${userId} hubId=${hubId}: ${this.getErrorMessage(error)}`,
      );

      throw new BadGatewayException(
        `Backend is unreachable at ${this.backendUrl}`,
      );
    }

    this.logger.log(
      `Backend hub config response userId=${userId} hubId=${hubId} status=${response.status}`,
    );

    if (response.status === 404) {
      throw new NotFoundException(`Overlay hub ${hubId} not found`);
    }

    if (!response.ok) {
      const body = await response.text();

      this.logger.error(
        `Backend failed while loading overlay config userId=${userId} hubId=${hubId} status=${response.status} body=${body}`,
      );

      throw new BadGatewayException(
        `Could not load hub from backend: ${response.status}`,
      );
    }

    const hub = (await response.json()) as Record<string, any>;
    const layers = Array.isArray(hub?.['layout']?.['layers'])
      ? hub['layout']['layers'].length
      : 0;

    this.logger.log(
      `Loaded hub config hubId=${hubId} hubName=${String(hub?.['hubName'] ?? '')} layers=${layers}`,
    );

    return hub;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
