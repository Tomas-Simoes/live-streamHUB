import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { UserDocument, UsersService } from './users.service';
import { AuthGuard } from 'src/auth/guard/auth.guard';
import { UpdateUserDto } from './dto/update/update-user.dto';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @ApiOperation({
    summary: 'Get a user by id',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the user to fetch.',
    example: '93b35cc5-c510-4cb3-a8d1-6fbd71544c4f',
  })
  @ApiOkResponse()
  @Get(':id')
  findById(@Param() params: { id: string }) {
    return this.usersService.findById(params.id);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update a user profile',
    description:
      'Updates the username for the selected user. Email update requests are accepted by the DTO, but the email change flow is not implemented yet.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the user to update.',
    example: '93b35cc5-c510-4cb3-a8d1-6fbd71544c4f',
  })
  @ApiOkResponse()
  @Patch('update/username/:id')
  @UseGuards(AuthGuard)
  @UsePipes(new ValidationPipe())
  async updateUser(
    @Param() params: { id: string },
    @Body() updateUser: UpdateUserDto,
  ): Promise<UserDocument> {
    return this.usersService.updateUser(params.id, updateUser);
  }
}
