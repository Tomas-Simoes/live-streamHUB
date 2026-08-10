import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SecurityTokensDto {
  @ApiProperty({
    description: 'JWT access token used to call protected API endpoints.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access-token',
  })
  @IsNotEmpty()
  @IsString()
  accessToken: string;

  @ApiProperty({
    description: 'Refresh token used to request a new access token.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh-token',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;

  @ApiProperty({
    description: 'Short-lived token containing user identity claims.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.id-token',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

export class RefreshedTokensDto {
  @ApiProperty({
    description: 'Fresh JWT access token used to call protected API endpoints.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new-access-token',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Replacement refresh token for future refresh requests.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new-refresh-token',
  })
  newRefreshToken: string;
}
