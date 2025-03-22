import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { User } from "./schema/users.schema";
import { Model } from "mongoose";
import { CreateUserDto } from "./dto/CreateUser.dto";

@Injectable()
export class UsersService {
    constructor(@InjectModel(User.name) private userModel: Model<User>) { }

    createUser(createUserDto: CreateUserDto) {
        const newUser = new this.userModel(createUserDto)
        return newUser.save()
    }

    async findOne(username: string): Promise<User | undefined> {
        return this.userModel.findOne({ username })
    }

    async findUserById(id: string): Promise<User | undefined> {
        return this.userModel.findById(id)
    }
}