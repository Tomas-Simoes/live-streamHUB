import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { HubDocument, HubsService } from "./hubs.service";
import { CreateHubDto } from "./dto/create/create-hub.dto";
import { UpdateHubDto } from "./dto/update/update-hub.dto";
import { AuthGuard } from "src/auth/guard/auth.guard";

// TODO add guards on there endpoints
@Controller('hub')
export class HubsController {
    constructor(private hubsService: HubsService) { }

    @Get()
    getAllHubs() {
        return this.hubsService.getAllHubs()
    }

    @Get('mine')
    @UseGuards(AuthGuard)
    getMyHubs(@Req() req) {
        return this.hubsService.getUserHubs(req.user.sub)
    }

    @Post('create')
    @UseGuards(AuthGuard)
    @UsePipes(new ValidationPipe())
    createHub(@Body() createHubDto: CreateHubDto, @Req() req) {
        return this.hubsService.createHUB({
            ...createHubDto,
            userId: req.user.sub
        })
    }

    @Get('get/:userId')
    @UsePipes(new ValidationPipe())
    getHubsByUserId(@Param() params: { userId: string }) {
        return this.hubsService.getUserHubs(params.userId)
    }

    @Get(':hubId')
    @UsePipes(new ValidationPipe())
    getHubById(@Param() params: { hubId: string }) {
        return this.hubsService.getHubById(params.hubId)
    }

    @Patch('update/:hubId')
    @UseGuards(AuthGuard)
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async updateHub(
        @Param() params: { hubId: string },
        @Body() updateHubDto: UpdateHubDto,
        @Req() req
    ) {
        const { hubId } = params;
        return this.hubsService.updateUserHub(hubId, req.user.sub, updateHubDto)
    }

    @Delete('delete/:hubId')
    @UseGuards(AuthGuard)
    deleteHub(
        @Param() params: { hubId: string },
        @Req() req
    ) {
        return this.hubsService.deleteUserHub(params.hubId, req.user.sub)
    }
}
