import {
  Controller,
  Get,
  Header,
  Injectable,
  NestInterceptor,
  CallHandler,
  ExecutionContext,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Observable, tap } from "rxjs";
import { getMetrics } from "@at72-verse/observability";

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const started = Date.now();
    const route = req.route?.path ? String(req.route.path) : req.path;
    return next.handle().pipe(
      tap({
        next: () => {
          const metrics = getMetrics();
          const status = String(res.statusCode || 200);
          metrics.httpRequestDuration.observe(
            { method: req.method, route, status },
            Date.now() - started,
          );
          metrics.httpRequests.inc({ method: req.method, route, status });
        },
        error: () => {
          const metrics = getMetrics();
          const status = String(res.statusCode || 500);
          metrics.httpRequestDuration.observe(
            { method: req.method, route, status },
            Date.now() - started,
          );
          metrics.httpRequests.inc({ method: req.method, route, status });
        },
      }),
    );
  }
}

@Controller()
export class MetricsController {
  @Get("metrics")
  @Header("content-type", "text/plain; version=0.0.4; charset=utf-8")
  metrics(): string {
    return getMetrics().renderPrometheus();
  }
}
