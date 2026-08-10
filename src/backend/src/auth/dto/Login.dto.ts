import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Email address used to identify the account.',
    example: 'streamer@example.com',
  })
  @IsNotEmpty()
  @IsString()
  email: string;

  // TODO change to isStrongPassword()
  @ApiProperty({
    description: 'Plain text password for the account.',
    example: 'super-secret-password',
  })
  @IsNotEmpty()
  @IsString()
  password: string;
}
