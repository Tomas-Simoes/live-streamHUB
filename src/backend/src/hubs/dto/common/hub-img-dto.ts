import { PartialType } from "@nestjs/mapped-types";
import { Type } from "class-transformer";
import { IsString, IsNotEmpty, IsObject, ValidateNested, IsNumber, IsOptional } from "class-validator";
import { PositionDto } from "src/common/dto/PositionDto.dto";

export class HubIMGDto {
    @IsString()
    @IsNotEmpty()
    imgUrl: string

    @IsString()
    @IsNotEmpty()
    htmlId: string

    @IsObject()
    @ValidateNested()
    @Type(() => PositionDto)
    position: PositionDto
}

export class UpdateHubImgDto extends PartialType(HubIMGDto) {
    @IsOptional()
    position?: PositionDto;
}