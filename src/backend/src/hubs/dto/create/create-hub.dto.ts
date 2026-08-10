import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { HubIMGDto } from '../common/hub-img-dto';
import { Type } from 'class-transformer';
import { HubFeatureDto } from '../common/hub-feature-dto';

export class CreateHubDto {
  @ApiProperty({
    description: 'Human-readable name shown for this hub layout.',
    example: 'League Finals Overlay',
  })
  @IsNotEmpty()
  @IsString()
  hubName: string;

  @ApiPropertyOptional({
    description:
      'Owner user id. Authenticated create requests overwrite this with the id from the access token.',
    example: '66b8f9a254a0f1c6f9d7a001',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Image layers that should be rendered in the hub.',
    type: () => [HubIMGDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HubIMGDto)
  @IsOptional()
  imgs?: HubIMGDto[];

  @ApiPropertyOptional({
    description: 'Dynamic game-data feature layers rendered in the hub.',
    type: () => [HubFeatureDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HubFeatureDto)
  @IsOptional()
  features?: HubFeatureDto[];

  @ApiPropertyOptional({
    description:
      'Free-form editor layout metadata, such as dimensions, layer order, and style configuration.',
    example: {
      id: 'league-finals-overlay',
      width: 1920,
      height: 1080,
      layers: ['team-logo-blue', 'blue-kills-counter'],
    },
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  @IsOptional()
  layout?: Record<string, any>;
}
