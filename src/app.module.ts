import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { DatabaseModule } from '@/modules/database/database.module';
import { MarketModule } from '@/modules/market/market.module';
import { NotificationModule } from '@/modules/notification/notification.module';
import { OrderModule } from '@/modules/order/order.module';

import { MarketMonitorJob } from '@/jobs/market-monitor.job';
import { MarketRecorderJob } from '@/jobs/market-recorder.job';
import { StrategyJob } from '@/jobs/strategy.job';

@Module({
    imports: [ScheduleModule.forRoot(), DatabaseModule, MarketModule, OrderModule, NotificationModule],
    controllers: [],
    providers: [MarketMonitorJob, StrategyJob, MarketRecorderJob],
})
export class AppModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(
                require('@/common/middlewares/logging.middleware').uuidMiddleware,
                require('@/common/middlewares/logging.middleware').entryPointLoggingMiddleware
            )
            .forRoutes('*');
    }
}
