import { IsNotEmpty, IsUUID } from 'class-validator';

export class GetHubByUserIdDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
