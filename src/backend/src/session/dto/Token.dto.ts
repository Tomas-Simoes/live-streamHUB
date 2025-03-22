import { IsNotEmpty, IsString } from "class-validator"

export class TokenDto {
    @IsNotEmpty()
    @IsString()
    accessToken: string

    @IsString()
    refreshToken?: string
}