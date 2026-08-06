import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { REQUEST_ID_HEADER } from '../request-id.middleware';

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
}

const STATUS_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.PAYMENT_REQUIRED]: 'PAYMENT_REQUIRED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
  [HttpStatus.NOT_IMPLEMENTED]: 'NOT_IMPLEMENTED',
  [HttpStatus.BAD_GATEWAY]: 'BAD_GATEWAY',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
  [HttpStatus.GATEWAY_TIMEOUT]: 'GATEWAY_TIMEOUT',
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsHandler');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = request.requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);

    const body = this.toBody(exception, requestId);
    response.status(body.status).json({
      code: body.code,
      message: body.message,
      details: body.details,
      requestId,
    });
  }

  private toBody(exception: unknown, requestId: string): ApiErrorBody & { status: number } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return {
          status,
          code: STATUS_CODES[status] ?? `HTTP_${status}`,
          message: res,
          requestId,
        };
      }
      const body = res as Record<string, unknown>;
      const rawMessage = body.message;
      const details = Array.isArray(rawMessage) ? rawMessage : undefined;
      const message =
        typeof rawMessage === 'string'
          ? rawMessage
          : Array.isArray(rawMessage)
            ? rawMessage.join(', ')
            : exception.message;
      return {
        status,
        code: typeof body.code === 'string' ? body.code : STATUS_CODES[status] ?? `HTTP_${status}`,
        message,
        details,
        requestId,
      };
    }

    this.logger.error(
      `Unhandled exception on ${requestId}`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: STATUS_CODES[HttpStatus.INTERNAL_SERVER_ERROR],
      message: 'Internal server error',
      requestId,
    };
  }
}
