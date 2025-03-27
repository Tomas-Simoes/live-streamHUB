import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Hub, HubFeature, HubIMG } from './schema/hubs.schema';
import { HydratedDocument, Model } from 'mongoose';
import { CreateHubDto } from './dto/create/create-hub.dto';
import { User } from 'src/users/schema/users.schema';
import { UpdateHubDto } from './dto/update/update-hub.dto';

export type HubDocument = HydratedDocument<Hub>

@Injectable()
export class HubsService {
    constructor(
        @InjectModel(Hub.name) private hubModel: Model<Hub>,
        @InjectModel(User.name) private userModel: Model<User>
    ) { }

    async createHUB(createHubDto: CreateHubDto): Promise<HubDocument> {
        const user = await this.userModel.findById(createHubDto.userId)

        if (!user) throw new NotFoundException("User not found.")
        const newHub = new this.hubModel(createHubDto)
        newHub.user = user
        const savedHub = await newHub.save()

        await user.updateOne({
            $push: {
                hubs: savedHub._id
            }
        })

        return savedHub
    }

    async getUserHubs(userId: string): Promise<HubDocument[]> {
        return this.hubModel.find({ user: userId })
    }

    async getHubById(hubId: string): Promise<HubDocument> {
        const hub = this.hubModel.findById(hubId)

        if (!hub) throw new NotFoundException(`Hub ${hubId} not found`)

        return hub;
    }

    async updateHub(hubId: string, updateHubDto: UpdateHubDto): Promise<HubDocument> {
        const { imgs, features, ...hubData } = updateHubDto

        const updateQuery: any = { $set: {} }

        if (hubData) {
            Object.assign(updateQuery.$set, hubData)
        }

        if (imgs) {
            imgs.forEach((img, index) => {
                Object.keys(img).forEach((key) => {
                    if (img[key] !== undefined) {
                        updateQuery.$set[`imgs.$[img${index}].${key}`] = img[key]
                    }
                })
            })
        }

        if (features) {
            features.forEach((feature, index) => {
                Object.keys(feature).forEach((key) => {
                    if (feature[key] !== undefined) {
                        updateQuery.$set[`features.$[feature${index}].${key}`] = feature[key]
                    }
                })
            })
        }

        return await this.hubModel.findOneAndUpdate(
            { _id: hubId },
            updateQuery,
            {
                new: true,
                runValidators: true,
                arrayFilters: [
                    ...imgs?.map((img, index) => ({
                        [`img${index}.htmlId`]: img.htmlId
                    })) || [],

                    ...features?.map((feature, index) => ({
                        [`feature${index}.htmlId`]: feature.htmlId
                    })) || []
                ]
            }
        )
    }

    async deleteHub(hubId: string) {
        return await this.hubModel.findByIdAndDelete(hubId)
    }
}
