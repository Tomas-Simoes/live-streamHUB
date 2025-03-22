import { Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Session } from "./schema/session.schema";
import { HydratedDocument, Model, Types } from "mongoose";
import { JwtService } from "@nestjs/jwt";
import { UsersService } from "src/users/users.service";
import { CreateSessionDto } from "./dto/CreateSession.dto";
import * as crypto from 'crypto'
import { RefreshSessionDto } from "./dto/RefreshSession.dto";
import { TokenDto } from "./dto/Token.dto";

export type SessionDocument = HydratedDocument<Session>


@Injectable()
export class SessionService {
    constructor(
        @InjectModel(Session.name) private sessionModel: Model<Session>,
        private jwtService: JwtService,
        private usersService: UsersService
    ) { }

    async createSession(createSessionDto: CreateSessionDto): Promise<TokenDto> {
        const { user, userAgent, ipAddress } = createSessionDto

        const accessToken = await this.generateAccessToken({ sub: user._id, username: user.username })
        const refreshToken = this.generateRefreshToken()

        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 30)

        const session = new this.sessionModel({
            userId: user._id,
            refreshToken,
            userAgent,
            ipAddress,
            expiresAt
        })

        await session.save()
            .catch(error => { throw new InternalServerErrorException("Error creating a new session: ", error) })

        return {
            accessToken,
            refreshToken
        }
    }

    async refreshToken(refreshTokenDto: RefreshSessionDto): Promise<{ accessToken: string }> {
        const { refreshToken, userAgent, ipAddress } = refreshTokenDto

        const session = await this.sessionModel.findOne({ refreshToken })

        if (!session) {
            throw new UnauthorizedException("Invalid refresh token")
        }

        if (session.isRevoked || new Date() > session.expiresAt) {
            throw new UnauthorizedException("Session expired or revoked.")
        }

        if (session.userAgent !== userAgent) {
            await this.revokeSession(session._id)
            throw new UnauthorizedException("Session revoked. User agent was changed.")
        }

        const user = await this.usersService.findById(session.userId)

        if (!user) {
            throw new NotFoundException("User not found.")
        }

        const accessToken = await this.generateAccessToken({ sub: user._id, username: user.username })

        session.updatedAt = new Date()
        await session.save()

        return { accessToken }
    }

    async revokeSession(sessionId: Types.ObjectId): Promise<void> {
        const session = await this.sessionModel.findOne({ sessionId })

        if (!session) {
            throw new NotFoundException("Session not found.")
        }

        session.isRevoked = true
        await session.save()
    }

    async validateSession(refreshToken): Promise<boolean> {
        const session = await this.sessionModel.findOne({ refreshToken })

        if (!session) return false;

        return !session.isRevoked && new Date() < session.expiresAt
    }

    private generateRefreshToken(): string {
        return crypto.randomBytes(8).toString('hex')
    }

    private async generateAccessToken(payload): Promise<string> {
        return await this.jwtService.signAsync(payload)
    }
}