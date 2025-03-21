import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { HubsModule } from './hubs/hubs.module';
import { CommonModule } from './common/common.module';

import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    HubsModule,
    CommonModule,
    ConfigModule.forRoot({
      envFilePath: ['.env.development']
    }),
    DatabaseModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
