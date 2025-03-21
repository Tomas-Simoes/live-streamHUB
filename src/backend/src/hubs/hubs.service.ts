import { HttpException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Hub } from './schema/hubs.schema';
import { Model } from 'mongoose';
import { CreateHubDto } from './dto/CreateHub.dto';
import { User } from 'src/users/schema/users.schema';

@Injectable()
export class HubsService {
    constructor(
        @InjectModel(Hub.name) private hubModel: Model<Hub>,
        @InjectModel(User.name) private userModel: Model<User>
    ) { }

    async createHUB({ userId, ...createHubDto }: CreateHubDto) {
        const findUser = await this.userModel.findById(userId)

        if (!findUser) throw new HttpException('User not found', 404)

        const newHub = new this.hubModel(createHubDto)
        const savedHub = await newHub.save()

        await findUser.updateOne({
            $push: {
                hubs: savedHub._id
            }
        })

        return savedHub
    }
}
