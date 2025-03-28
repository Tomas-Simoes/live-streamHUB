import { Body, Controller, Delete, Get, Param, Patch, Post, UsePipes, ValidationPipe } from "@nestjs/common";
import { HubDocument, HubsService } from "./hubs.service";
import { CreateHubDto } from "./dto/create/create-hub.dto";
import { UpdateHubDto } from "./dto/update/update-hub.dto";

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

    @Get('get/:userId')
    @UsePipes(new ValidationPipe())
    getHubsByUserId(@Param() params: { userId: string }) {
        return this.hubsService.getUserHubs(params.userId)
    }

    @Patch('update/:hubId')
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async updateHub(
        @Param() params: { hubId: string },
        @Body() updateHubDto: UpdateHubDto
    ) {
        const { hubId } = params;
        return this.hubsService.updateHub(hubId, updateHubDto)
    }

    @Delete('delete/:hubId')
    deleteHub(
        @Param() params: { hubId: string },
    ) {
        return this.hubsService.deleteHub(params.hubId)
    }
}