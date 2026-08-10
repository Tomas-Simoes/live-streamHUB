import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly configService: ConfigService) {
    const connectionString = configService.get<string>('database.url');
    const adapter = new PrismaPg({ connectionString });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async healthCheck(): Promise<{
    status: 'ok' | 'error';
    message: string;
    error?: string;
  }> {
    try {
      await this.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        message: 'Database connection is healthy.',
      };
    } catch (error: unknown) {
      return {
        status: 'error',
        message: 'Database connection is not healthy.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
