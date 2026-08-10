import { Hub } from 'src/hubs/schema/hubs.schema';

export class User {
  id: string;

  _id: string;

  username: string;

  password: string;

  email: string;

  hubs?: Hub[];
}
