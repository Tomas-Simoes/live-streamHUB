import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from './config/config.module';

@Module({
  imports: [DatabaseModule, ConfigModule]
})
export class CommonModule {}
