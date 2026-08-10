import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class PositionDto {
  @ApiProperty({
    description: 'Horizontal position of the element on the hub canvas.',
    example: 120,
  })
  @IsNumber()
  @IsNotEmpty()
  x: number;

  @ApiProperty({
    description: 'Vertical position of the element on the hub canvas.',
    example: 80,
  })
  @IsNumber()
  @IsNotEmpty()
  y: number;
}
