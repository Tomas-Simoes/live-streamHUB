import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { AuthGuard } from 'src/auth/guard/auth.guard';
import { CreateHubDto } from './dto/create/create-hub.dto';
import { UpdateHubDto } from './dto/update/update-hub.dto';
import { HubsService } from './hubs.service';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Hub } from './schema/hubs.schema';

// TODO add guards on there endpoints
@ApiTags('hubs')
@Controller('hub')
export class HubsController {
  constructor(private hubsService: HubsService) {}

  @ApiOperation({
    summary: 'List all hubs',
    description: 'Returns every hub layout in reverse creation order.',
  })
  @ApiOkResponse({ type: [Hub] })
  @Get()
  getAllHubs() {
    return this.hubsService.getAllHubs();
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List hubs owned by the current user',
    description:
      'Uses the authenticated user id from the access token to scope the hub list.',
  })
  @ApiOkResponse({ type: [Hub] })
  @Get('mine')
  @UseGuards(AuthGuard)
  getMyHubs(@CurrentUser('sub') userId: string) {
    return this.hubsService.getUserHubs(userId);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create a hub',
    description:
      'Creates a hub layout for the authenticated user. Any userId in the body is replaced with the id from the access token.',
  })
  @ApiCreatedResponse({ type: Hub })
  @Post('create')
  @UseGuards(AuthGuard)
  @UsePipes(new ValidationPipe())
  createHub(
    @Body() createHubDto: CreateHubDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.hubsService.createHUB({
      ...createHubDto,
      userId,
    });
  }

  @ApiOperation({
    summary: 'List hubs for a specific user',
    description: 'Returns every hub layout owned by the provided user id.',
  })
  @ApiParam({
    name: 'userId',
    description: 'UUID of the user whose hubs should be returned.',
    example: '93b35cc5-c510-4cb3-a8d1-6fbd71544c4f',
  })
  @ApiOkResponse({ type: [Hub] })
  @Get('get/:userId')
  @UsePipes(new ValidationPipe())
  getHubsByUserId(@Param() params: { userId: string }) {
    return this.hubsService.getUserHubs(params.userId);
  }

  @ApiOperation({
    summary: 'Get one hub',
    description:
      'Finds a hub by UUID. If the value is not a UUID, it falls back to matching layout.id.',
  })
  @ApiParam({
    name: 'hubId',
    description: 'Hub UUID or a layout.id value.',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiOkResponse({ type: Hub })
  @Get(':hubId')
  @UsePipes(new ValidationPipe())
  getHubById(@Param() params: { hubId: string }) {
    return this.hubsService.getHubById(params.hubId);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update a hub owned by the current user',
    description:
      'Updates the selected hub only when it belongs to the authenticated user. Undefined body fields are ignored.',
  })
  @ApiParam({
    name: 'hubId',
    description: 'UUID of the hub to update.',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiOkResponse({ type: Hub })
  @Patch('update/:hubId')
  @UseGuards(AuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async updateHub(
    @Param() params: { hubId: string },
    @Body() updateHubDto: UpdateHubDto,
    @CurrentUser('sub') userId: string,
  ) {
    const { hubId } = params;
    return this.hubsService.updateUserHub(hubId, userId, updateHubDto);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete a hub owned by the current user',
    description:
      'Deletes the selected hub only when it belongs to the authenticated user.',
  })
  @ApiParam({
    name: 'hubId',
    description: 'UUID of the hub to delete.',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiOkResponse({ type: Hub })
  @Delete('delete/:hubId')
  @UseGuards(AuthGuard)
  deleteHub(
    @Param() params: { hubId: string },
    @CurrentUser('sub') userId: string,
  ) {
    return this.hubsService.deleteUserHub(params.hubId, userId);
  }
}
