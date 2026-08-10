import {
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { Request, Response } from 'express';
import { RefreshTokenGuard } from './guard/refresh-token.guard';
import {
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { RefreshedTokensDto } from './dto/Token.dto';

// TODO before production check again this requirements: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
@ApiTags('session')
@Controller('session')
export class SessionController {
  constructor(private sessionService: SessionService) {}

  @ApiSecurity('refresh-token')
  @ApiOperation({
    summary: 'Refresh an authenticated session',
    description:
      'Validates the refresh token from the Authorization header, creates replacement tokens, sets updated auth cookies, and returns the fresh tokens.',
  })
  @ApiOkResponse({
    type: RefreshedTokensDto,
  })
  @HttpCode(200)
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  async refreshToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string; newRefreshToken: string }> {
    const userAgent = request.headers['user-agent'] || 'unknown';
    const ipAddress = request.ip || 'unknown';
    const [, refreshToken] = request.headers.authorization?.split(' ') || [];

    const refreshedTokens: {
      accessToken: string;
      newRefreshToken: string;
    } = await this.sessionService.refreshToken({
      refreshToken,
      userAgent,
      ipAddress,
    });

    response.cookie('accessToken', refreshedTokens.accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 1000, // 1 min
    });

    response.cookie('refreshToken', refreshedTokens.newRefreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    });

    return refreshedTokens;
  }
}
