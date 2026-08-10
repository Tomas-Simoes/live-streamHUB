import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateHubDto } from './dto/create/create-hub.dto';
import { UpdateHubDto } from './dto/update/update-hub.dto';
import { DatabaseService } from 'src/database/database.service';
import { Prisma } from '../../generated/prisma/client';
import { Hub } from './schema/hubs.schema';

const hubInclude = {
  imgs: true,
  features: true,
} satisfies Prisma.HubInclude;

type HubRecord = Prisma.HubGetPayload<{
  include: typeof hubInclude;
}>;

export type HubDocument = Hub;

@Injectable()
export class HubsService {
  constructor(private readonly database: DatabaseService) {}

  async getAllHubs(): Promise<HubDocument[]> {
    const hubs = await this.database.hub.findMany({
      include: hubInclude,
      orderBy: { createdAt: 'desc' },
    });

    return hubs.map((hub) => this.toHubDocument(hub));
  }

  async createHUB(createHubDto: CreateHubDto): Promise<HubDocument> {
    const owner = createHubDto.userId
      ? await this.database.user.findUnique({
          where: { id: createHubDto.userId },
        })
      : null;

    if (createHubDto.userId && !owner) {
      throw new NotFoundException('User not found.');
    }

    const savedHub = await this.database.hub.create({
      data: {
        hubName: createHubDto.hubName,
        layout: this.toInputJson(createHubDto.layout),
        user: owner
          ? {
              connect: {
                id: owner.id,
              },
            }
          : undefined,
        imgs: {
          create: (createHubDto.imgs ?? []).map((img) => ({
            imgUrl: img.imgUrl,
            htmlId: img.htmlId,
            position: this.toInputJson(img.position),
          })),
        },
        features: {
          create: (createHubDto.features ?? []).map((feature) => ({
            feature: feature.feature,
            htmlId: feature.htmlId,
            position: this.toInputJson(feature.position),
          })),
        },
      },
      include: hubInclude,
    });

    return this.toHubDocument(savedHub);
  }

  async getUserHubs(userId: string): Promise<HubDocument[]> {
    const hubs = await this.database.hub.findMany({
      where: { userId },
      include: hubInclude,
      orderBy: { createdAt: 'desc' },
    });

    return hubs.map((hub) => this.toHubDocument(hub));
  }

  async getHubById(hubId: string): Promise<HubDocument> {
    const hub = this.isUuid(hubId)
      ? await this.database.hub.findUnique({
          where: { id: hubId },
          include: hubInclude,
        })
      : await this.database.hub.findFirst({
          where: {
            layout: {
              path: ['id'],
              equals: hubId,
            },
          },
          include: hubInclude,
        });

    if (!hub) throw new NotFoundException(`Hub ${hubId} not found`);

    return this.toHubDocument(hub);
  }

  async updateHub(
    hubId: string,
    updateHubDto: UpdateHubDto,
  ): Promise<HubDocument> {
    return this.updateHubRecord(hubId, undefined, updateHubDto);
  }

  async updateUserHub(
    hubId: string,
    userId: string,
    updateHubDto: UpdateHubDto,
  ): Promise<HubDocument> {
    return this.updateHubRecord(hubId, userId, updateHubDto, ['userId']);
  }

  async deleteHub(hubId: string) {
    const deletedHub = await this.database.hub.delete({
      where: { id: hubId },
      include: hubInclude,
    });

    return this.toHubDocument(deletedHub);
  }

  async deleteUserHub(hubId: string, userId: string) {
    const hub = await this.database.hub.findFirst({
      where: {
        id: hubId,
        userId,
      },
    });

    if (!hub) {
      throw new NotFoundException(`Hub ${hubId} not found for this user`);
    }

    const deletedHub = await this.database.hub.delete({
      where: { id: hubId },
      include: hubInclude,
    });

    return this.toHubDocument(deletedHub);
  }

  private async updateHubRecord(
    hubId: string,
    userId: string | undefined,
    updateHubDto: UpdateHubDto,
    excludedKeys: Array<keyof UpdateHubDto> = [],
  ): Promise<HubDocument> {
    const hub = await this.database.hub.findFirst({
      where: {
        id: hubId,
        ...(userId ? { userId } : {}),
      },
    });

    if (!hub) {
      throw new NotFoundException(
        userId
          ? `Hub ${hubId} not found for this user`
          : `Hub ${hubId} not found`,
      );
    }

    if (
      updateHubDto.userId &&
      !excludedKeys.includes('userId') &&
      !(await this.database.user.findUnique({
        where: { id: updateHubDto.userId },
      }))
    ) {
      throw new NotFoundException('User not found.');
    }

    const updatedHub = await this.database.$transaction(async (transaction) => {
      if (updateHubDto.imgs !== undefined) {
        await transaction.hubImage.deleteMany({
          where: { hubId },
        });
      }

      if (updateHubDto.features !== undefined) {
        await transaction.hubFeature.deleteMany({
          where: { hubId },
        });
      }

      return transaction.hub.update({
        where: { id: hubId },
        data: {
          ...(updateHubDto.hubName !== undefined
            ? { hubName: updateHubDto.hubName }
            : {}),
          ...(updateHubDto.layout !== undefined
            ? { layout: this.toInputJson(updateHubDto.layout) }
            : {}),
          ...(updateHubDto.userId !== undefined &&
          !excludedKeys.includes('userId')
            ? {
                user: {
                  connect: {
                    id: updateHubDto.userId,
                  },
                },
              }
            : {}),
          ...(updateHubDto.imgs !== undefined
            ? {
                imgs: {
                  create: updateHubDto.imgs.map((img) => ({
                    imgUrl: img.imgUrl,
                    htmlId: img.htmlId,
                    position: this.toInputJson(img.position),
                  })),
                },
              }
            : {}),
          ...(updateHubDto.features !== undefined
            ? {
                features: {
                  create: updateHubDto.features.map((feature) => ({
                    feature: feature.feature,
                    htmlId: feature.htmlId,
                    position: this.toInputJson(feature.position),
                  })),
                },
              }
            : {}),
        },
        include: hubInclude,
      });
    });

    return this.toHubDocument(updatedHub);
  }

  private toHubDocument(hub: HubRecord): HubDocument {
    return {
      ...hub,
      _id: hub.id,
      user: hub.userId,
      imgs: hub.imgs.map((img) => ({
        imgUrl: img.imgUrl,
        htmlId: img.htmlId,
        position: img.position as { x: number; y: number },
      })),
      features: hub.features.map((feature) => ({
        feature: feature.feature,
        htmlId: feature.htmlId,
        position: feature.position as { x: number; y: number },
      })),
      layout: hub.layout as Record<string, any> | null,
    };
  }

  private toInputJson(value: unknown): Prisma.InputJsonValue | undefined {
    return value === undefined ? undefined : (value as Prisma.InputJsonValue);
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
