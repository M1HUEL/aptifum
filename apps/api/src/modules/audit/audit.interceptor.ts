import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { AuditAction } from '@aptifum/core';
import { Observable, mergeMap } from 'rxjs';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      return next.handle();
    }
    return next.handle().pipe(
      mergeMap(async (response) => {
        await this.auditService.record({
          tenantId: request.user?.tenantId ?? null,
          userId: request.user?.id ?? null,
          module: moduleFromPath(request.path),
          entity: entityFromPath(request.path),
          entityId: entityIdFromPath(request.path),
          action: actionForMethod(request.method),
          after: request.body,
          requestId: request.requestId,
          ip: request.ip ?? null,
        });
        return response;
      }),
    );
  }
}

function segmentsOf(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function moduleFromPath(path: string): string {
  const segments = segmentsOf(path);
  const base = segments.findIndex((segment) => segment === 'v1');
  return segments[base + 1] ?? 'unknown';
}

function entityFromPath(path: string): string {
  const segments = segmentsOf(path);
  const base = segments.findIndex((segment) => segment === 'v1');
  return segments[base + 2] ?? moduleFromPath(path);
}

function entityIdFromPath(path: string): string | null {
  const segments = segmentsOf(path);
  const base = segments.findIndex((segment) => segment === 'v1');
  const candidate = segments[base + 3];
  return candidate && candidate !== 'me' ? candidate : null;
}

function actionForMethod(method: string): AuditAction {
  switch (method) {
    case 'DELETE':
      return AuditAction.DELETE;
    case 'PUT':
    case 'PATCH':
      return AuditAction.UPDATE;
    default:
      return AuditAction.CREATE;
  }
}
