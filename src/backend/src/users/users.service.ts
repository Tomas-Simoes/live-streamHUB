import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { User } from "./schema/users.schema";
import { HydratedDocument, Model } from "mongoose";
import { RegisterDto } from "src/auth/dto/Register.dto";


export type UserDocument = HydratedDocument<User>

@Injectable()
export class UsersService {
    constructor(@InjectModel(User.name) private userModel: Model<User>) { }

    createUser(registerDto: RegisterDto): Promise<UserDocument> {
        const newUser = new this.userModel(registerDto)

        return newUser.save()
            .catch(error => { throw new InternalServerErrorException("Error creating a new user: ", error) })
    }

    async findOne(key: keyof User, value: any): Promise<User | undefined> {
        return this.userModel.findOne({ [key]: value })
    }

    async findById(id: string): Promise<User | undefined> {
        return this.userModel.findById(id)
    }
}