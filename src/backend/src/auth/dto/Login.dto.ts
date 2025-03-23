import { IsNotEmpty, IsString } from "class-validator"

export class LoginDto {
    @IsNotEmpty()
    @IsString()
    email: string

    // TODO change to isStrongPassword()
    @IsNotEmpty()
    @IsString()
    password: string
}