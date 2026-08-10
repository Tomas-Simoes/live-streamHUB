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

export class HubIMGDto {
  @ApiProperty({
    description: 'Public URL or asset path for the image displayed on the hub.',
    example: 'https://cdn.example.com/assets/team-logo.png',
  })
  @IsString()
  @IsNotEmpty()
  imgUrl: string;

  @ApiProperty({
    description:
      'HTML element id used by the editor to identify this image layer.',
    example: 'team-logo-blue',
  })
  @IsString()
  @IsNotEmpty()
  htmlId: string;

  @ApiProperty({
    description: 'Canvas position where the image layer should be placed.',
    type: () => PositionDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => PositionDto)
  position: PositionDto;
}

export class UpdateHubImgDto extends PartialType(HubIMGDto) {
  @ApiPropertyOptional({
    description: 'Optional replacement position for the image layer.',
    type: () => PositionDto,
  })
  @IsOptional()
  position?: PositionDto;
}
