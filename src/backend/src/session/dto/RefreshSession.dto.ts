import { IsNotEmpty, IsString } from "class-validator"

export class RefreshSessionDto {
    @IsNotEmpty()
    @IsString()
    refreshToken: string

    @IsNotEmpty()
    @IsString()
    userAgent: string

    @IsNotEmpty()
    @IsString()
    ipAddress: string
}