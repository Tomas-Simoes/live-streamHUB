import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { NAME_REGEX } from 'src/common/regex.const';

export class RegisterDto {
  @ApiProperty({
    description:
      'Public username for the new account. It must be 3 to 50 characters and cannot contain special characters.',
    example: 'livecaster_01',
    minLength: 3,
    maxLength: 50,
  })
  @IsNotEmpty()
  @IsString()
  @Length(3, 50)
  @Matches(NAME_REGEX, {
    message: 'Name must not have special characters.',
  })
  username: string;

  @ApiProperty({
    description:
      'Password for the new account. It must be at least 8 characters.',
    example: 'super-secret-password',
    minLength: 8,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 character long. ' })
  password: string;

  @ApiProperty({
    description: 'Email address for the new account.',
    example: 'streamer@example.com',
    minLength: 5,
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @Length(5, 255)
  email: string;
}
