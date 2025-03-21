import { Injectable, UnauthorizedException } from "@nestjs/common";
import { UsersService } from "src/users/users.service";
import { SignInDto } from "./dto/SignIn.dto";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService
    ) { }

    async signIn(signInDto: SignInDto): Promise<{ access_token: string }> {
        const user = await this.usersService.findOne(signInDto.username)

        if (user?.password !== signInDto.password) {
            throw new UnauthorizedException()
        }

        const payload = { sub: user._id, username: user.username }
        return {
            access_token: await this.jwtService.signAsync(payload)
        }
    }


}