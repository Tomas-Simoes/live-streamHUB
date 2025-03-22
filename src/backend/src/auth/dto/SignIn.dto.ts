import { IsNotEmpty, IsString } from "class-validator"

export class SignInDto {
    @IsNotEmpty()
    @IsString()
    username: string

    // TODO change to isStrongPassword()
    @IsNotEmpty()
    @IsString()
    password: string
}