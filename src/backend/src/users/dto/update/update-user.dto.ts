import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description:
      'Replacement username. It must be 3 to 50 characters and may contain letters, numbers, underscores, and hyphens.',
    example: 'livecaster_02',
    minLength: 3,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(3, 50, { message: 'Username must be between 3 and 50 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'Username can only contain letters, numbers, underscores, and hyphens',
  })
  username?: string;

  @ApiPropertyOptional({
    description:
      'Replacement email address. The current service starts the email change flow but does not complete it yet.',
    example: 'new-streamer@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;
}
