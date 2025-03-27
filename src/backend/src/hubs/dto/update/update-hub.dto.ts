import { Type } from "class-transformer";
import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator";
import { HubIMGDto, UpdateHubImgDto } from "../common/hub-img-dto";
import { HubFeatureDto, UpdateHubFeatureDto } from "../common/hub-feature-dto";
import { PartialType } from "@nestjs/mapped-types";

export class UpdateHubDto {
    @IsOptional()
    @IsString()
    hubName: string;

    @IsOptional()
    @IsString()
    userId: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateHubImgDto)
    @IsOptional()
    imgs?: UpdateHubImgDto[]

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateHubFeatureDto)
    @IsOptional()
    features?: UpdateHubFeatureDto[]
}