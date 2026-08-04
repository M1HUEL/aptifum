import { AuthUser } from '@aptifum/core';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId: string;
    }
  }
}

export {};
