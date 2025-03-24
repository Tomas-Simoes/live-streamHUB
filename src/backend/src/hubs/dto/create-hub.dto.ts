import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from "class-validator";
import { HubIMGDto } from "./hub-img-dto";
import { Type } from "class-transformer";
import { HubFeatureDto } from "./hub-feature-dto";

export class CreateHubDto {
    @IsNotEmpty()
    @IsString()
    hubName: string;

    @IsNotEmpty()
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