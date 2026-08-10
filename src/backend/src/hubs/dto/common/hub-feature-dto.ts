import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsObject,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { PositionDto } from 'src/common/dto/PositionDto.dto';

export class HubFeatureDto {
  @ApiProperty({
    description: 'Game data binding or feature key rendered by this hub layer.',
    example: 'blueTeam.kills',
  })
  @IsString()
  @IsNotEmpty()
  feature: string;

  @ApiProperty({
    description:
      'HTML element id used by the editor to identify this feature layer.',
    example: 'blue-kills-counter',
  })
  @IsString()
  @IsNotEmpty()
  htmlId: string;

  @ApiProperty({
    description: 'Canvas position where the feature layer should be placed.',
    type: () => PositionDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => PositionDto)
  position: PositionDto;
}

export class UpdateHubFeatureDto extends PartialType(HubFeatureDto) {
  @ApiPropertyOptional({
    description: 'Optional replacement position for the feature layer.',
    type: () => PositionDto,
  })
  @IsOptional()
  position?: PositionDto;
}
