import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { MarketModule } from '@/modules/market/market.module';
import { NotificationModule } from '@/modules/notification/notification.module';
import { OrderModule } from '@/modules/order/order.module';

import { MarketMonitorJob } from '@/jobs/market-monitor.job';
import { StrategyJob } from '@/jobs/strategy.job';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MarketModule,
    OrderModule,
    NotificationModule
  ],
  controllers: [],
  providers: [
      MarketMonitorJob,
      StrategyJob
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(require('@/common/middlewares/logging.middleware').uuidMiddleware, require('@/common/middlewares/logging.middleware').entryPointLoggingMiddleware)
      .forRoutes('*');
  }
}
