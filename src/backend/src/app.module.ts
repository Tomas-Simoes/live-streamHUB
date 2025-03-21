import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { HubsModule } from './hubs/hubs.module';
import { CommonModule } from './common/common.module';
import { MongooseModule } from '@nestjs/mongoose';

import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    UserModule,
    AuthModule,
    HubsModule,
    CommonModule,
    MongooseModule.forRoot(''),
    ConfigModule.forRoot({
      envFilePath: ['.env.development']
    })
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
