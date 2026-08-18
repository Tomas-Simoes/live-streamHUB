import { Module } from '@nestjs/common';
import { GameDataModule } from './game-data/game-data.module';
import { OverlayModule } from './overlay/overlay.module';

@Module({
  imports: [GameDataModule, OverlayModule],
})
export class AppModule {}
