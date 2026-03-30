import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginatedMeta } from '../interfaces/paginated-result.interface';

export interface StandardResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  meta?: PaginatedMeta;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, StandardResponse<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    const ctx = context.switchToHttp();
    const statusCode = ctx.getResponse().statusCode ?? 200;

    return next.handle().pipe(
      map((data: unknown) => {
        const base = {
          success: true,
          statusCode,
          message: 'Operación exitosa',
          timestamp: new Date().toISOString(),
        };

        if (
          data &&
          typeof data === 'object' &&
          'data' in data &&
          'meta' in data &&
          Array.isArray((data as { data: unknown }).data)
        ) {
          const paginated = data as { data: T; meta: PaginatedMeta };
          return {
            ...base,
            data: paginated.data as T,
            meta: paginated.meta,
          };
        }

        return {
          ...base,
          data: data as T,
        };
      }),
    );
  }
}
