import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { UserDocument, UsersService } from "src/users/users.service";
import { LoginDto } from "./dto/Login.dto";
import { RegisterDto } from "./dto/Register.dto";

import * as bcrypt from 'bcrypt'
import { User } from "src/users/schema/users.schema";
import { SessionService } from "src/session/session.service";
import { SecurityTokensDto } from "src/session/dto/Token.dto";

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private sessionService: SessionService
    ) { }

    async register(registerDto: RegisterDto): Promise<UserDocument> {
        const existingUsername = await this.usersService.findOne('username', registerDto.username)

        if (existingUsername) {
            throw new ConflictException("Username already exists.")
        }

        const existingEmail = await this.usersService.findOne('email', registerDto.email)

        if (existingEmail) {
            throw new ConflictException("Email already exists.")
        }

        const salt = await bcrypt.genSalt()
        const hashedPassword = await bcrypt.hash(registerDto.password, salt)

        registerDto.password = hashedPassword

        return this.usersService.createUser(registerDto)
    }

    async login(loginDto: LoginDto, userAgent: string, ipAddress: string): Promise<SecurityTokensDto> {
        const user: User | undefined = await this.usersService.findOne('email', loginDto.email)

        if (!user) {
            throw new NotFoundException("User not found. Credentials are invalid.")
        }

        const isMatch: boolean = await bcrypt.compare(loginDto.password, user.password)
        if (!isMatch) {
            throw new UnauthorizedException("Invalid credentials.")
        }

        return this.sessionService.createSession({ user, userAgent, ipAddress })
    }
}