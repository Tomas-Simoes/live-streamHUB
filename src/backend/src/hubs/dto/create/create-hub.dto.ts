import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";
import { HubIMGDto } from "../common/hub-img-dto";
import { Type } from "class-transformer";
import { HubFeatureDto } from "../common/hub-feature-dto";

export class CreateHubDto {
    @IsNotEmpty()
    @IsString()
    hubName: string;

    @IsOptional()
    @IsString()
    userId?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => HubIMGDto)
    @IsOptional()
    imgs?: HubIMGDto[]

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => HubFeatureDto)
    @IsOptional()
    features?: HubFeatureDto[]

    @IsObject()
    @IsOptional()
    layout?: Record<string, any>
}
