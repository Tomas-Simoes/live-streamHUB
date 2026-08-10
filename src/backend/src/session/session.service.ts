import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { CreateSessionDto } from './dto/CreateSession.dto';
import * as crypto from 'crypto';
import { RefreshSessionDto } from './dto/RefreshSession.dto';
import { SecurityTokensDto } from './dto/Token.dto';
import { DatabaseService } from 'src/database/database.service';
import { Session } from '../../generated/prisma/client';

export type SessionDocument = Session & { _id: string };
type JwtPayload = Record<string, string>;

@Injectable()
export class SessionService {
  constructor(
    private readonly database: DatabaseService,
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  async createSession(
    createSessionDto: CreateSessionDto,
  ): Promise<SecurityTokensDto> {
    const { user, userAgent, ipAddress } = createSessionDto;

    // TODO change role to an actual role
    const userId = String(user._id || user.id);
    const accessToken = await this.generateJWTToken({
      sub: userId,
      role: 'user',
    });
    const idToken = await this.generateJWTToken({
      sub: userId,
      username: user.username,
      email: user.email,
    });
    const refreshToken = this.generateRefreshToken();

    const createdAt = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.database.session
      .create({
        data: {
          refreshToken,
          userId,
          userAgent,
          ipAddress,
          expiresAt,
          createdAt,
          updatedAt: createdAt,
        },
      })
      .catch((error: unknown) => {
        throw new InternalServerErrorException(
          `Error creating a new session: ${this.getErrorMessage(error)}`,
        );
      });

    return {
      accessToken,
      refreshToken,
      idToken,
    };
  }

  async refreshToken(
    refreshSessionDto: RefreshSessionDto,
  ): Promise<{ accessToken: string; newRefreshToken: string }> {
    const { refreshToken, userAgent, ipAddress } = refreshSessionDto;

    const session = await this.database.session.findUnique({
      where: { refreshToken },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.isRevoked || new Date() > session.expiresAt) {
      throw new UnauthorizedException('Session expired or revoked.');
    }

    if (session.userAgent !== userAgent) {
      await this.revokeSession(session.id);
      throw new UnauthorizedException(
        'Session revoked. User agent was changed.',
      );
    }

    if (session.ipAddress !== ipAddress) {
      await this.revokeSession(session.id);
      throw new UnauthorizedException(
        'Session revoked. IP Address was changed.',
      );
    }

    const user = await this.usersService.findById(session.userId);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const accessToken = await this.generateJWTToken({
      sub: String(user._id || user.id),
      role: 'user',
    });
    const newRefreshToken = this.generateRefreshToken();

    await this.database.session
      .update({
        where: { id: session.id },
        data: {
          refreshToken: newRefreshToken,
          updatedAt: new Date(),
        },
      })
      .catch((error: unknown) => {
        throw new InternalServerErrorException(
          `Error refreshing session: ${this.getErrorMessage(error)}`,
        );
      });

    return { accessToken, newRefreshToken };
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = await this.database.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    await this.database.session
      .update({
        where: { id: sessionId },
        data: {
          isRevoked: true,
        },
      })
      .catch((error: unknown) => {
        throw new InternalServerErrorException(
          `Error revoking session: ${this.getErrorMessage(error)}`,
        );
      });
  }

  async validateSession(refreshToken: string): Promise<boolean> {
    const session = await this.database.session.findUnique({
      where: { refreshToken },
    });

    if (!session) return false;

    return !session.isRevoked && new Date() < session.expiresAt;
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateJWTToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
