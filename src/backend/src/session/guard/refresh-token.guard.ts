import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { SessionService } from "../session.service";
import { Request } from "express";

@Injectable()
export class RefreshTokenGuard implements CanActivate {
    constructor(private sessionService: SessionService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>()
        const refreshToken = this.extractRefreshToken(request)

        if (!refreshToken) {
            throw new UnauthorizedException('Refresh token not provided.')
        }

        const isValid = await this.sessionService.validateSession(refreshToken)

        if (!isValid) throw new UnauthorizedException('Invalid or expired refresh token.')

        return true;
    }

    private extractRefreshToken(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? []
        if (type === 'Refresh') {
            return token
        }

        return undefined
    }
}