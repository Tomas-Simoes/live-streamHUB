import { Body, Controller, Get, Param, Post, UsePipes, ValidationPipe } from "@nestjs/common";
import { UsersService } from "./users.service";

@Controller('users')
export class UsersController {
    constructor(private usersService: UsersService) { }

    @Get(":id")
    findById(
        @Param() params: any
    ) {
        return this.usersService.findById(params.id)
    }
}