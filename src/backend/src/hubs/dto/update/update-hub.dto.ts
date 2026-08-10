import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { UpdateHubImgDto } from '../common/hub-img-dto';
import { UpdateHubFeatureDto } from '../common/hub-feature-dto';

export class UpdateHubDto {
  @ApiPropertyOptional({
    description: 'Replacement display name for the hub layout.',
    example: 'League Finals Overlay v2',
  })
  @IsOptional()
  @IsString()
  hubName: string;

  @ApiPropertyOptional({
    description:
      'Owner user id. This field is ignored by authenticated user-scoped updates.',
    example: '66b8f9a254a0f1c6f9d7a001',
  })
  @IsOptional()
  @IsString()
  userId: string;

  @ApiPropertyOptional({
    description: 'Replacement image layer list for the hub.',
    type: () => [UpdateHubImgDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateHubImgDto)
  @IsOptional()
  imgs?: UpdateHubImgDto[];

  @ApiPropertyOptional({
    description:
      'Replacement dynamic game-data feature layer list for the hub.',
    type: () => [UpdateHubFeatureDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateHubFeatureDto)
  @IsOptional()
  features?: UpdateHubFeatureDto[];

  @ApiPropertyOptional({
    description:
      'Replacement free-form editor layout metadata, such as dimensions, layer order, and style configuration.',
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
  layout?: Record<string, unknown>;
}
