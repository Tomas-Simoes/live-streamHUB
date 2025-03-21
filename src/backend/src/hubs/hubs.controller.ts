import { Body, Controller, Get, Post, UsePipes, ValidationPipe } from "@nestjs/common";
import { HubsService } from "./hubs.service";
import { CreateHubDto } from "./dto/CreateHub.dto";

@Controller('hubs')
export class HubsController {
    constructor(private hubsService: HubsService) { }

    @Post()
    @UsePipes(new ValidationPipe())
    createHub(@Body() createHubDto: CreateHubDto) {
        console.log(createHubDto)
        return this.hubsService.createHUB(createHubDto)
    }

}