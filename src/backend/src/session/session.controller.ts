import { Body, Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { SessionService } from "./session.service";
import { Request } from "express";
import { RefreshTokenGuard } from "./guard/refresh-token.guard";


// TODO
@Controller('session')
export class SessionController {
    constructor(private sessionService: SessionService) { }

    @HttpCode(200)
    @UseGuards(RefreshTokenGuard)
    @Post('refresh')
    async refreshToken(
        @Body() body: { refreshToken: string },
        @Req() request: Request
    ): Promise<{ accessToken: string }> {
        const userAgent = request.headers['user-agent'] || 'unknown';
        const ipAddress = request.ip || 'unknown';
        const [type, refreshToken] = request.headers.authorization?.split(' ') || []

        console.log("trying to refresh token", refreshToken)
        return this.sessionService.refreshToken({
            refreshToken,
            userAgent,
            ipAddress
        });
    }
}