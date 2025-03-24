import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Hub } from './schema/hubs.schema';
import { HydratedDocument, Model } from 'mongoose';
import { CreateHubDto } from './dto/create-hub.dto';
import { User } from 'src/users/schema/users.schema';
import { GetHubByUserIdDto } from './dto/get-hub-user_id.dto';
import { UpdateHubDto } from './dto/update-hub.dto';

type HubDocument = HydratedDocument<Hub>

@Injectable()
export class HubsService {
    constructor(
        @InjectModel(Hub.name) private hubModel: Model<Hub>,
        @InjectModel(User.name) private userModel: Model<User>
    ) { }

    async createHUB(createHubDto: CreateHubDto): Promise<HubDocument> {
        const user = await this.userModel.findById(createHubDto.userId)

        if (!user) throw new NotFoundException("User not found.")
        console.log('createdto', createHubDto)
        const newHub = new this.hubModel(createHubDto)
        newHub.user = user
        console.log('newhub', newHub)
        const savedHub = await newHub.save()
        console.log('test')

        await user.updateOne({
            $push: {
                hubs: savedHub._id
            }
        })

        return savedHub
    }

    async getByUserID({ userId }: GetHubByUserIdDto): Promise<HubDocument[]> {
        return this.hubModel.find({ user: userId })
    }

    async updateHub(hubId: string, updateHubDto: UpdateHubDto): Promise<HubDocument> {
        const hub = await this.hubModel.findById(hubId)

        if (!hub) throw new NotFoundException(`Hub ${hubId} not found`)

        return await hub.updateOne({ $set: updateHubDto }, { new: true, runValidators: true })
    }

    async deleteHub(hubId: string) {
        return await this.hubModel.findByIdAndDelete(hubId)
    }
}
