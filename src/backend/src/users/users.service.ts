import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { RegisterDto } from 'src/auth/dto/Register.dto';
import { UpdateUserDto } from './dto/update/update-user.dto';
import { DatabaseService } from 'src/database/database.service';
import { User } from '../../generated/prisma/client';

export type UserDocument = User & { _id: string };

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService) {}

  createUser(registerDto: RegisterDto): Promise<UserDocument> {
    return this.database.user
      .create({
        data: {
          username: registerDto.username,
          email: registerDto.email,
          password: registerDto.password,
        },
      })
      .then((user) => this.toUserDocument(user))
      .catch((error: unknown) => {
        throw new InternalServerErrorException(
          `Error creating a new user: ${this.getErrorMessage(error)}`,
        );
      });
  }

  async updateUser(
    userId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserDocument> {
    const user = await this.database.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException();
    }

    if (updateUserDto.username) {
      const updatedUser = await this.database.user.update({
        where: { id: userId },
        data: {
          username: updateUserDto.username,
        },
      });

      return this.toUserDocument(updatedUser);
    }

    if (updateUserDto.email) {
      await this.requestEmailChange();
    }

    return this.toUserDocument(user);
  }

  async requestEmailChange() {}

  async findOne<K extends 'id' | 'username' | 'email'>(
    key: K,
    value: User[K],
  ): Promise<UserDocument | null> {
    const user = await this.database.user.findUnique({
      where:
        key === 'id'
          ? { id: value as string }
          : key === 'username'
            ? { username: value as string }
            : { email: value as string },
    });

    return user ? this.toUserDocument(user) : null;
  }

  async findById(id: string): Promise<UserDocument | null> {
    const user = await this.database.user.findUnique({
      where: { id },
    });

    return user ? this.toUserDocument(user) : null;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  private toUserDocument(user: User): UserDocument {
    return {
      ...user,
      _id: user.id,
    };
  }
}
