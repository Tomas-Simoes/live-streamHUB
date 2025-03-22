import { IsNotEmpty, IsString, Length, Matches, MinLength } from "class-validator"
import { NAME_REGEX } from "src/common/regex.const"

export class RegisterDto {
    @IsNotEmpty()
    @IsString()
    @Length(3, 50)
    @Matches(NAME_REGEX, {
        message: 'Name must not have special characters.'
    })
    username: string

    @IsNotEmpty()
    @IsString()
    @MinLength(8, { message: "Password must be at least 8 character long. " })
    password: string

    @IsNotEmpty()
    @IsString()
    @Length(5, 255)
    email: string
}