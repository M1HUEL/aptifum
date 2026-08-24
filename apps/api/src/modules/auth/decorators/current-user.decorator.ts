import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthUser } from '@aptifum/core';

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser | undefined => {
  const request = context.switchToHttp().getRequest();
  return request.user;
});
