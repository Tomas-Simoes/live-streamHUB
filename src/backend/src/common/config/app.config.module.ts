import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import databaseConfig from './database.config';
import jwtConfig from './jwt.config';
@Module({
    imports: [
        ConfigModule.forRoot({
            load: [appConfig, databaseConfig, jwtConfig],
            isGlobal: true,
            envFilePath: `.env.${process.env.NODE_ENV || 'development'}`
        }),
    ]
})
export class AppConfigModule { }
