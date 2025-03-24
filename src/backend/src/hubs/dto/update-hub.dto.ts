import { Type } from "class-transformer";
import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator";
import { HubIMGDto } from "./hub-img-dto";
import { HubFeatureDto } from "./hub-feature-dto";

export class UpdateHubDto {
    @IsOptional()
    @IsString()
    hubName: string;

    @IsOptional()
    @IsString()
    userId: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => HubIMGDto)
    @IsOptional()
    img?: HubIMGDto[]

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => HubFeatureDto)
    @IsOptional()
    features?: HubIMGDto[]
}