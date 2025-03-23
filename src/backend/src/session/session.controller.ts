import { Body, Controller, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common";
import { SessionService } from "./session.service";
import { Request, Response } from "express";
import { RefreshTokenGuard } from "./guard/refresh-token.guard";


// TODO before production check again this requirements: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
@Controller('session')
export class SessionController {
    constructor(private sessionService: SessionService) { }

    @HttpCode(200)
    @UseGuards(RefreshTokenGuard)
    @Post('refresh')
    async refreshToken(
        @Body() body: { refreshToken: string },
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response
    ): Promise<{ accessToken: string, newRefreshToken: string }> {
        const userAgent = request.headers['user-agent'] || 'unknown';
        const ipAddress = request.ip || 'unknown';
        const [type, refreshToken] = request.headers.authorization?.split(' ') || []

        const refreshedTokens:
            {
                accessToken: string,
                newRefreshToken: string
            } =
            await this.sessionService.refreshToken({
                refreshToken,
                userAgent,
                ipAddress
            });

        response.cookie('accessToken', refreshedTokens.accessToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'strict',
            maxAge: 60 * 1000 // 1 min
        })

        response.cookie('refreshToken', refreshedTokens.newRefreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
        })

        return refreshedTokens
    }
}