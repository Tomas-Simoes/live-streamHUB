import { Type } from "class-transformer"
import { IsNotEmpty, IsString, ValidateNested } from "class-validator"
import { User } from "src/users/schema/users.schema"

export class CreateSessionDto {
    @IsNotEmpty()
    @ValidateNested()
    @Type(() => User)
    user: User

    @IsNotEmpty()
    @IsString()
    userAgent: string

    @IsNotEmpty()
    @IsString()
    ipAddress: string


}