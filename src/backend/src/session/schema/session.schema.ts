export class Session {
  id: string;

  _id: string;

  refreshToken: string;

  isRevoked: boolean;

  userId: string;

  userAgent: string;

  ipAddress: string;

  expiresAt: Date;

  createdAt: Date;

  updatedAt: Date;
}
