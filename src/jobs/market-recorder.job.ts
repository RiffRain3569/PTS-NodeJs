import { MarketRepository } from '@/modules/market/infrastructure/market.repository';
import { MarketService } from '@/modules/market/market.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
@Injectable()
export class MarketRecorderJob {
    private readonly logger = new Logger(MarketRecorderJob.name);

    constructor(private readonly marketService: MarketService, private readonly marketRepository: MarketRepository) {}

    @Cron('0 1 * * * *')
    async handleCron() {
        this.logger.debug('Starting Market Recorder Job...');
        const now = new Date();
        const previousHour = new Date(now.getTime() - 60 * 60 * 1000);

        try {
            // 1. Bitget Top 5
            const bitgetRunId = await this.marketRepository.createJobRun('bitget', 'hourly', 60, 'last', 'UTC');
            const bitgetMarkets = await this.marketService.getBitgetTop5Markets();

            for (const item of bitgetMarkets) {
                const symbol = item.market;
                try {
                    await this.marketService.calculateTradeResult('bitget', symbol, previousHour, {
                        holdingMinutes: 60,
                        side: 'LONG',
                        runId: bitgetRunId,
                    });
                    await this.marketService.calculateTradeResult('bitget', symbol, previousHour, {
                        holdingMinutes: 60,
                        side: 'SHORT',
                        runId: bitgetRunId,
                    });
                } catch (err: any) {
                    this.logger.warn(`Failed to calc Bitget result for ${symbol}: ${err.message}`);
                }
            }

            // 2. Bithumb Top 5
            const bithumbRunId = await this.marketRepository.createJobRun('bithumb', 'hourly', 120, 'last', 'UTC');
            const bithumbMarkets = await this.marketService.getTop5Markets();

            for (const item of bithumbMarkets) {
                const symbol = item.market;
                try {
                    await this.marketService.calculateTradeResult('bithumb', symbol, previousHour, {
                        holdingMinutes: 120,
                        side: 'LONG',
                        runId: bithumbRunId,
                    });
                } catch (err: any) {
                    this.logger.warn(`Failed to calc Bithumb result for ${symbol}: ${err.message}`);
                }
            }

            this.logger.debug('Market Recorder Job Completed.');
        } catch (e) {
            this.logger.error('Error in Market Recorder Job', e);
        }
    }
}
