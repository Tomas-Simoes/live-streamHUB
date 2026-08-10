import { Module } from '@nestjs/common';
import { HubsService } from './hubs.service';
import { HubsController } from './hubs.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [HubsService],
  controllers: [HubsController],
})
export class HubsModule {}
