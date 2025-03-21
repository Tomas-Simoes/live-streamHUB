import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class DatabaseService {
    constructor(@InjectConnection() private readonly connection: Connection) { }

    getConnection(): Connection {
        return this.connection
    }

    isConnected(): boolean {
        return this.connection.readyState === 1
    }

    async healthCheck() {
        try {
            await this.connection.db.admin().ping();
            return {
                status: 'ok',
                message: 'Database connection is healthy.'
            }
        } catch (error) {
            return {
                status: 'error',
                message: 'Database connection is not healthy.',
                error: error
            }
        }
    }
}
