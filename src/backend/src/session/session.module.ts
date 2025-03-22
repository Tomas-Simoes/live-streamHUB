import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Session, SessionSchema } from "./schema/session.schema";
import { JwtModule } from "@nestjs/jwt";
import { jwtConstants } from "src/auth/constants";
import { UsersModule } from "src/users/users.module";
import { SessionService } from "./session.service";
import { SessionController } from "./session.controller";

@Module({
    imports: [
        MongooseModule.forFeature([{
            name: Session.name,
            schema: SessionSchema
        }]),
        JwtModule.register({
            global: true,
            secret: jwtConstants.secret,
            signOptions: { expiresIn: '60s' }
        }),
        UsersModule
    ],
    providers: [SessionService],
    controllers: [SessionController],
    exports: [SessionService]
})
export class SessionModule {


}