import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

interface DatabaseConfig {
  user: string,
  password: string,
  host: string,
  options: string
}

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const dbConfig = configService.get<DatabaseConfig>('database')
        const dbURI = `mongodb+srv://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}${dbConfig.options}`

        console.log('Connecting to MongoDB at:', dbURI)

        return {
          uri: dbURI,
          connectionFactory: (connection) => {
            if (connection.readyState === 1) {
              console.log('Database connected sucessfully')
            }

            connection.on('error', (error) => {
              console.error('MongoDB connection error: ', error);
            });

            connection.on('disconnected', () => {
              console.log('MongoDB connection disconnected.');
            });

            return connection;
          },
        }
      },
      inject: [ConfigService]
    })
  ],
  providers: [DatabaseService],
  exports: [DatabaseService]
})
export class DatabaseModule { }
