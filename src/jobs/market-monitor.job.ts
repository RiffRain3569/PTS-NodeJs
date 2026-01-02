import { MarketService } from '@/modules/market/market.service';
import { NotificationService } from '@/modules/notification/notification.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class MarketMonitorJob {
    private readonly logger = new Logger(MarketMonitorJob.name);

    constructor(
        private readonly marketService: MarketService,
        private readonly notificationService: NotificationService,
    ) {}

    // 1시 - 21시 사이 1시간 마다 실행
    // NestJS Cron pattern: second minute hour day month day-of-week
    // original: 1 ${hour} * * * where hours = 1..21 except 0,7,8,9
    // NestJS supports standard cron patterns. We can use multiple methods or standard cron string.
    
    // We can list specific hours: 1,2,3,4,5,6,10,11,12,13,14,15,16,17,18,19,20,21
    @Cron('1 0 1,2,3,4,5,6,10,11,12,13,14,15,16,17,18,19,20,21 * * *')
    async handleNotiCron() {
        try {
            this.logger.debug('Running Market Monitor Job');
            const markets = await this.marketService.getTop5Markets();
            await this.notificationService.send(JSON.stringify(markets, null, 4));
        } catch (error) {
            this.logger.error(error);
        }
    }
}
