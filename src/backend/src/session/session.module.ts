import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Session, SessionSchema } from "./schema/session.schema";
import { JwtModule } from "@nestjs/jwt";
import { UsersModule } from "src/users/users.module";
import { SessionService } from "./session.service";
import { SessionController } from "./session.controller";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
    imports: [
        MongooseModule.forFeature([{
            name: Session.name,
            schema: SessionSchema
        }]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('jwt.secret'),
                signOptions: { expiresIn: '60s' },
            }),
            global: true
        }),
        UsersModule
    ],
    providers: [SessionService],
    controllers: [SessionController],
    exports: [SessionService]
})
export class SessionModule {


}