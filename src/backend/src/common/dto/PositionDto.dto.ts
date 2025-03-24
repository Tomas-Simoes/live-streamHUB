import { IsNotEmpty, IsNumber } from "class-validator";

export class PositionDto {
    @IsNumber()
    @IsNotEmpty()
    x: number

    @IsNumber()
    @IsNotEmpty()
    y: number
}