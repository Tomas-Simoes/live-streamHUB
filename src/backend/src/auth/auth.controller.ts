import { Get, Req, Body, Controller, Post, HttpCode, HttpStatus, UseGuards, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/Login.dto';
import { AuthGuard } from './guard/auth.guard';
import { RegisterDto } from './dto/Register.dto';
import { TokenDto } from 'src/session/dto/Token.dto';
import { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('register')
    register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto)
    }

    @HttpCode(HttpStatus.OK)
    @Post('login')
    async login(
        @Body() loginDto: LoginDto,
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response
    ): Promise<TokenDto> {
        const userAgent = request.headers['user-agent'] || 'unknown'
        const ipAddress = request.ip || 'unknown'

        response.cookie

        const { accessToken, refreshToken } = await this.authService.login(loginDto, userAgent, ipAddress)

        // TODO change secure to true when we get https
        response.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'strict',
            maxAge: 60 * 1000 // 1 min
        })

        response.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
        })

        return { accessToken, refreshToken }
    }

    @UseGuards(AuthGuard)
    @Get('protected')
    getProfile(@Req() req) {
        return req.user
    }
}
