import { Type } from "class-transformer";
import { IsString, IsNotEmpty, IsObject, ValidateNested, IsNumber } from "class-validator";
import { PositionDto } from "src/common/dto/PositionDto.dto";

export class HubFeatureDto {
    @IsString()
    @IsNotEmpty()
    featureName: string

    @IsObject()
    @ValidateNested()
    @Type(() => PositionDto)
    position: PositionDto
}