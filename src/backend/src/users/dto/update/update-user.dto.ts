import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, Matches } from "class-validator";

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    @Length(3, 50, { message: 'Username must be between 3 and 50 characters' })
    @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'Username can only contain letters, numbers, underscores, and hyphens' })
    username?: string;

    @IsOptional()
    @IsEmail({}, { message: 'Invalid email format' })
    email?: string;
}