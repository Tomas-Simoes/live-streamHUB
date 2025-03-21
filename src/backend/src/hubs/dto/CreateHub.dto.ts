import { IsNotEmpty, IsString } from "class-validator";

export class CreateHubDto {
    @IsNotEmpty()
    @IsString()
    hubName: string;

    @IsNotEmpty()
    @IsString()
    userId: string;
}