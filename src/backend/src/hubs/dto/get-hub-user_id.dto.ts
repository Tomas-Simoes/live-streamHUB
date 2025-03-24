import { IsMongoId, IsNotEmpty, IsString } from "class-validator";

export class GetHubByUserIdDto {
    @IsMongoId()
    @IsNotEmpty()
    userId: string
}