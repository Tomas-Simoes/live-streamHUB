import { createParamDecorator } from '@nestjs/common';
import { AuthenticatedRequest, AuthenticatedUser } from './guard/auth.guard';

export const CurrentUser = createParamDecorator<
  keyof AuthenticatedUser | undefined,
  AuthenticatedUser | string | undefined
>((field, context) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

  if (field) {
    return request.user[field];
  }

  return request.user;
});
