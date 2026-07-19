import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { HttpMetricsInterceptor, MetricsController } from "./metrics.controller.js";

@Module({
  controllers: [MetricsController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
})
export class ObservabilityModule {}
