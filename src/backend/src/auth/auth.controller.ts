import {
  Get,
  Req,
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/Login.dto';
import { AuthGuard } from './guard/auth.guard';
import { RegisterDto } from './dto/Register.dto';
import { SecurityTokensDto } from 'src/session/dto/Token.dto';
import { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PublicUserDto } from 'src/users/dto/public-user.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a user account and returns the public profile without the password.',
  })
  @ApiCreatedResponse({ type: PublicUserDto })
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @ApiOperation({
    summary: 'Log in a user',
    description:
      'Validates email and password credentials, creates a session, sets auth cookies, and returns the issued tokens.',
  })
  @ApiOkResponse({ type: SecurityTokensDto })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SecurityTokensDto> {
    const userAgent = request.headers['user-agent'] || 'unknown';
    const ipAddress = request.ip || 'unknown';

    const { accessToken, refreshToken, idToken } = await this.authService.login(
      loginDto,
      userAgent,
      ipAddress,
    );

    /*
        TODO.
            * change secure to true when we get https
            * add domain and path attributes to cookies
        */
    response.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/',
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
    });

    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    });

    response.cookie('idToken', idToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 min
    });

    return { accessToken, refreshToken, idToken };
  }

  @ApiOperation({
    summary: 'Log out a user',
    description: 'Clears the browser auth cookies used by the frontend.',
  })
  @ApiOkResponse()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    const cookieOptions = {
      httpOnly: true,
      secure: false,
      sameSite: 'strict' as const,
      path: '/',
    };

    response.clearCookie('accessToken', cookieOptions);
    response.clearCookie('refreshToken', cookieOptions);
    response.clearCookie('idToken', cookieOptions);

    return { success: true };
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get the current user profile',
    description:
      'Reads the authenticated user id from the access token and returns the public profile.',
  })
  @ApiOkResponse({ type: PublicUserDto })
  @UseGuards(AuthGuard)
  @Get('me')
  getProfile(@CurrentUser('sub') userId: string) {
    return this.authService.getMe(userId);
  }
}
