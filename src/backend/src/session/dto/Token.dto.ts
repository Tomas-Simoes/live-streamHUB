import { isNotEmpty, IsNotEmpty, IsString } from "class-validator"

export class SecurityTokensDto {
    @IsNotEmpty()
    @IsString()
    accessToken: string

    @IsString()
    @IsNotEmpty()
    refreshToken: string

    @IsString()
    @IsNotEmpty()
    idToken: string
}