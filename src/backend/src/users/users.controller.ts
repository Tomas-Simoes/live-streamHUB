import { Body, Controller, Get, Param, Post, UsePipes, ValidationPipe } from "@nestjs/common";
import { CreateUserDto } from "./dto/CreateUser.dto";
import { UsersService } from "./users.service";

@Controller('users')
export class UsersController {
    constructor(private usersService: UsersService) { }

    @Post()
    @UsePipes(new ValidationPipe())
    createUser(
        @Body() createUserDto: CreateUserDto
    ) {
        return this.usersService.createUser(createUserDto)
    }

    @Get(":id")
    findUserById(
        @Param() params: any
    ) {
        return this.usersService.findUserById(params.id)
    }
}