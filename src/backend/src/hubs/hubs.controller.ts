import { Body, Controller, Delete, Get, Param, Patch, Post, UsePipes, ValidationPipe } from "@nestjs/common";
import { HubsService } from "./hubs.service";
import { CreateHubDto } from "./dto/create-hub.dto";
import { GetHubByUserIdDto } from "./dto/get-hub-user_id.dto";
import { UpdateHubDto } from "./dto/update-hub.dto";

// TODO add guards on there endpoints
@Controller('hub')
export class HubsController {
    constructor(private hubsService: HubsService) { }

    @Post('create')
    @UsePipes(new ValidationPipe())
    createHub(@Body() createHubDto: CreateHubDto) {
        console.log(createHubDto)
        return this.hubsService.createHUB(createHubDto)
    }

    @Get(':userId')
    @UsePipes(new ValidationPipe())
    getHubByUserId(@Param() params: GetHubByUserIdDto) {
        return this.hubsService.getByUserID(params)
    }

    // TODO get a way to update changes on img[] and feature[]
    @Patch('update/:hubId')
    @UsePipes(new ValidationPipe({ whitelist: true }))
    updateHub(
        @Param() params: { hubId: string },
        @Body() updateHubDto: UpdateHubDto
    ) {
        console.log(params.hubId)

        return this.hubsService.updateHub(params.hubId, updateHubDto)
    }

    @Delete('delete/:hubId')
    deleteHub(
        @Param() params: { hubId: string },
    ) {
        return this.hubsService.deleteHub(params.hubId)
    }
}