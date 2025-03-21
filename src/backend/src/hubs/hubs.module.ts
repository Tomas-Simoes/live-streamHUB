import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseModule } from 'src/database/database.module';
import { Hub, HubSchema } from './schema/hubs.schema';
import { HubsService } from './hubs.service';
import { HubsController } from './hubs.controller';
import { User, UserSchema } from 'src/users/schema/users.schema';

@Module({
    imports: [
        DatabaseModule,
        MongooseModule.forFeature([
            {
                name: Hub.name,
                schema: HubSchema
            },
            {
                name: User.name,
                schema: UserSchema
            }
        ])
    ],
    providers: [HubsService],
    controllers: [HubsController]
})
export class HubsModule { }
