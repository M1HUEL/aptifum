import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const incoming = req.headers[REQUEST_ID_HEADER];
    req.requestId = Array.isArray(incoming) ? incoming[0] : incoming ?? randomUUID();
    req.headers[REQUEST_ID_HEADER] = req.requestId;
    next();
  }
}
