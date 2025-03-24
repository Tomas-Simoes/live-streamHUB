import { Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Session } from "./schema/session.schema";
import { HydratedDocument, Model, Types } from "mongoose";
import { JwtService } from "@nestjs/jwt";
import { UsersService } from "src/users/users.service";
import { CreateSessionDto } from "./dto/CreateSession.dto";
import * as crypto from 'crypto'
import { RefreshSessionDto } from "./dto/RefreshSession.dto";
import { SecurityTokensDto } from "./dto/Token.dto";

export type SessionDocument = HydratedDocument<Session>


@Injectable()
export class SessionService {
    constructor(
        @InjectModel(Session.name) private sessionModel: Model<Session>,
        private jwtService: JwtService,
        private usersService: UsersService
    ) { }

    async createSession(createSessionDto: CreateSessionDto): Promise<SecurityTokensDto> {
        const { user, userAgent, ipAddress } = createSessionDto

        // TODO change role to an actual role
        const accessToken = await this.generateJWTToken({ sub: user._id, role: 'admin' })
        const idToken = await this.generateJWTToken({ sub: user._id, username: user.username, email: user.email })
        const refreshToken = this.generateRefreshToken()

        const createdAt = new Date()
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 30)

        const session = new this.sessionModel({
            refreshToken,
            userId: user._id,
            userAgent,
            ipAddress,
            expiresAt,
            createdAt,
            updatedAt: createdAt
        })

        await session.save()
            .catch(error => { throw new InternalServerErrorException("Error creating a new session: ", error) })

        return {
            accessToken,
            refreshToken,
            idToken
        }
    }

    async refreshToken(refreshSessionDto: RefreshSessionDto): Promise<{ accessToken: string, newRefreshToken: string }> {
        const { refreshToken, userAgent, ipAddress } = refreshSessionDto

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

        if (session.ipAddress !== ipAddress) {
            await this.revokeSession(session._id)
            throw new UnauthorizedException("Session revoked. IP Address was changed.")
        }

        const user = await this.usersService.findById(session.userId)

        if (!user) {
            throw new NotFoundException("User not found.")
        }

        const accessToken = await this.generateJWTToken({ sub: user._id, role: 'admin' })
        const newRefreshToken = await this.generateRefreshToken()

        session.refreshToken = newRefreshToken
        session.updatedAt = new Date()

        await session.save()
            .catch((error => { throw new InternalServerErrorException("Error refreshing session: ", error) }))

        return { accessToken, newRefreshToken }
    }

    async revokeSession(sessionId: Types.ObjectId): Promise<void> {
        const session = await this.sessionModel.findOne({ "_id": sessionId })

        if (!session) {
            throw new NotFoundException("Session not found.")
        }

        session.isRevoked = true
        await session.save()
            .catch(error => { throw new InternalServerErrorException("Error revoking session: ", error) })
    }

    async validateSession(refreshToken): Promise<boolean> {
        const session = await this.sessionModel.findOne({ refreshToken })

        if (!session) return false;

        return !session.isRevoked && new Date() < session.expiresAt
    }

    private generateRefreshToken(): string {
        return crypto.randomBytes(16).toString('hex')
    }

    private async generateJWTToken(payload): Promise<string> {
        return await this.jwtService.signAsync(payload)
    }
}