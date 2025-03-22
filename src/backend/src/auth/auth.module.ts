import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { AuthService } from './auth.service';
import { SessionModule } from 'src/session/session.module';

@Module({
  imports: [
    UsersModule,
    SessionModule
  ],
  providers: [AuthService],
  controllers: [AuthController]
})
export class AuthModule { }
