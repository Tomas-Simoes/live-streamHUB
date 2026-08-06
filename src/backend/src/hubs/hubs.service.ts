import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Hub } from './schema/hubs.schema';
import { HydratedDocument, isValidObjectId, Model } from 'mongoose';
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

    async getAllHubs(): Promise<HubDocument[]> {
        return this.hubModel.find().sort({ _id: -1 })
    }

    async createHUB(createHubDto: CreateHubDto): Promise<HubDocument> {
        const owner = createHubDto.userId ? await this.userModel.findById(createHubDto.userId) : null
        const newHub = new this.hubModel({
            ...createHubDto,
            imgs: createHubDto.imgs ?? [],
            features: createHubDto.features ?? []
        })

        if (createHubDto.userId && !owner) {
            throw new NotFoundException("User not found.")
        }

        if (owner) {
            newHub.user = owner
        }

        const savedHub = await newHub.save()

        if (owner) {
            await owner.updateOne({
                $push: {
                    hubs: savedHub._id
                }
            })
        }

        return savedHub
    }

    async getUserHubs(userId: string): Promise<HubDocument[]> {
        return this.hubModel.find({ user: userId }).sort({ _id: -1 })
    }

    async getHubById(hubId: string): Promise<HubDocument> {
        const hub = isValidObjectId(hubId)
            ? await this.hubModel.findById(hubId)
            : await this.hubModel.findOne({ 'layout.id': hubId })

        if (!hub) throw new NotFoundException(`Hub ${hubId} not found`)

        return hub;
    }

    async updateHub(hubId: string, updateHubDto: UpdateHubDto): Promise<HubDocument> {
        const updateQuery: Record<string, any> = {}

        Object.entries(updateHubDto).forEach(([key, value]) => {
            if (value !== undefined) {
                updateQuery[key] = value
            }
        })

        const updatedHub = await this.hubModel.findOneAndUpdate(
            { _id: hubId },
            { $set: updateQuery },
            {
                new: true,
                runValidators: true
            }
        )

        if (!updatedHub) throw new NotFoundException(`Hub ${hubId} not found`)

        return updatedHub
    }

    async updateUserHub(hubId: string, userId: string, updateHubDto: UpdateHubDto): Promise<HubDocument> {
        const updateQuery: Record<string, any> = {}

        Object.entries(updateHubDto).forEach(([key, value]) => {
            if (value !== undefined && key !== 'userId') {
                updateQuery[key] = value
            }
        })

        const updatedHub = await this.hubModel.findOneAndUpdate(
            { _id: hubId, user: userId },
            { $set: updateQuery },
            {
                new: true,
                runValidators: true
            }
        )

        if (!updatedHub) throw new NotFoundException(`Hub ${hubId} not found for this user`)

        return updatedHub
    }

    async deleteHub(hubId: string) {
        return await this.hubModel.findByIdAndDelete(hubId)
    }

    async deleteUserHub(hubId: string, userId: string) {
        const deletedHub = await this.hubModel.findOneAndDelete({ _id: hubId, user: userId })

        if (!deletedHub) throw new NotFoundException(`Hub ${hubId} not found for this user`)

        return deletedHub
    }
}
