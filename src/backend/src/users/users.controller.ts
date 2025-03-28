import { Body, Controller, Get, Param, Patch, Post, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { UserDocument, UsersService } from "./users.service";
import { AuthGuard } from "src/auth/guard/auth.guard";
import { UpdateUserDto } from "./dto/update/update-user.dto";

@Controller('users')
export class UsersController {
    constructor(private usersService: UsersService) { }

    @Get(":id")
    findById(
        @Param() params: any
    ) {
        return this.usersService.findById(params.id)
    }

    @Patch("update/username/:id")
    @UseGuards(AuthGuard)
    @UsePipes(new ValidationPipe())
    async updateUser(
        @Param() params: { userId: string },
        @Body() updateUser: UpdateUserDto
    ): Promise<UserDocument> {
        return this.usersService.updateUser(params.userId, updateUser);
    }
}