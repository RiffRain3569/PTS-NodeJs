import { MarketRepository } from '@/modules/market/infrastructure/market.repository';
import { MarketService } from '@/modules/market/market.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class MarketRecorderJob {
    private readonly logger = new Logger(MarketRecorderJob.name);

    constructor(private readonly marketService: MarketService, private readonly marketRepository: MarketRepository) {}

    @Cron('0 1 * * * *')
    async handleCron() {
        this.logger.debug('Starting Market Recorder Job...');
        const now = new Date();
        const kstOffset = 9 * 60 * 60 * 1000;
        const nowKst = new Date(now.getTime() + kstOffset);

        try {
            // 1. Close Pending Trades
            // Find trades where 'entry_time + holding_minutes' <= now (KST)
            const pendingTrades = await this.marketRepository.findPendingTrades(nowKst);
            this.logger.debug(`Found ${pendingTrades.length} pending trades to close.`);

            for (const trade of pendingTrades) {
                try {
                    // Convert KST entry time back to UTC for calculation logic
                    // logic: stored = UTC + offset. So UTC = stored - offset.
                    const entryTimeUtc = new Date(trade.entry_time.getTime() - kstOffset);

                    await this.marketService.calculateTradeResult(trade.exchange, trade.symbol, entryTimeUtc, {
                        holdingMinutes: trade.holding_minutes,
                        side: trade.side,
                        runId: trade.run_id || undefined,
                        priceBasis: trade.price_basis as any, // Preserve basis
                    });
                } catch (err: any) {
                    this.logger.warn(`Failed to close trade for ${trade.symbol}: ${err.message}`);
                }
            }

            // 2. Open New Trades (Bitget)
            const bitgetRunId = await this.marketRepository.createJobRun('bitget', 'hourly', 60, 'last', 'UTC');
            const bitgetMarkets = await this.marketService.getBitgetTop5Markets();

            for (const item of bitgetMarkets) {
                const symbol = item.market;
                try {
                    // LONG
                    await this.marketService.recordOpenTrade(
                        'bitget',
                        symbol,
                        now,
                        60,
                        item.trade_price,
                        'LONG',
                        bitgetRunId
                    );
                    // SHORT
                    await this.marketService.recordOpenTrade(
                        'bitget',
                        symbol,
                        now,
                        60,
                        item.trade_price,
                        'SHORT',
                        bitgetRunId
                    );
                } catch (err: any) {
                    this.logger.warn(`Failed to open Bitget trade for ${symbol}: ${err.message}`);
                }
            }

            // 3. Open New Trades (Bithumb)
            const bithumbRunId = await this.marketRepository.createJobRun('bithumb', 'hourly', 120, 'last', 'UTC');
            const bithumbMarkets = await this.marketService.getTop5Markets();

            for (const item of bithumbMarkets) {
                const symbol = item.market;
                try {
                    await this.marketService.recordOpenTrade(
                        'bithumb',
                        symbol,
                        now,
                        120,
                        item.trade_price.toString(), // Ensure string
                        'LONG',
                        bithumbRunId
                    );
                } catch (err: any) {
                    this.logger.warn(`Failed to open Bithumb trade for ${symbol}: ${err.message}`);
                }
            }

            this.logger.debug('Market Recorder Job Completed.');
        } catch (e: any) {
            const msg = e instanceof Error ? e.message : JSON.stringify(e);
            const stack = e instanceof Error ? e.stack : undefined;
            this.logger.error(`Error in Market Recorder Job: ${msg}`, stack);
        }
    }
}
