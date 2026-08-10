import { ApiProperty } from '@nestjs/swagger';

export class PublicUserDto {
  @ApiProperty({
    description: 'Unique user id.',
    example: '66b8f9a254a0f1c6f9d7a001',
  })
  id: string;

  @ApiProperty({
    description: 'Public username shown in the application.',
    example: 'livecaster_01',
  })
  username: string;

  @ApiProperty({
    description: 'Email address associated with the account.',
    example: 'streamer@example.com',
  })
  email: string;
}
