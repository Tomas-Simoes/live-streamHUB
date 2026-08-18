import { Controller, Get, Header, Logger, Param } from '@nestjs/common';
import { renderOverlayPage } from './overlay-page';
import { OverlayService } from './overlay.service';

@Controller('overlay')
export class OverlayController {
  private readonly logger = new Logger(OverlayController.name);

  constructor(private readonly overlay: OverlayService) {}

  @Get(':userId/:hubId/config')
  @Header('Cache-Control', 'no-store')
  getHubConfig(@Param() params: { userId: string; hubId: string }) {
    this.logger.log(
      `Config requested userId=${params.userId} hubId=${params.hubId}`,
    );

    return this.overlay.getHubConfig(params.userId, params.hubId);
  }

  @Get(':userId/:hubId')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  getOverlayPage(@Param() params: { userId: string; hubId: string }) {
    this.logger.log(
      `Page requested userId=${params.userId} hubId=${params.hubId}`,
    );

    return renderOverlayPage();
  }
}
