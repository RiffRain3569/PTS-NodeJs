import { MarketRepository } from '@/modules/market/infrastructure/market.repository';
import { MarketService } from '@/modules/market/market.service';
import { NotificationService } from '@/modules/notification/notification.service';
import { BitgetOrderService } from '@/modules/order/providers/bitget-order.service';
import { BithumbOrderService } from '@/modules/order/providers/bithumb-order.service';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

interface HoldHourOptions {
    hour: number;
    second?: number;
    duringHour?: number;
    top?: number;
    askPercent: number;
    position?: 'LONG' | 'SHORT';
}

interface BitgetHoldHourOptions {
    hour: number;
    second?: number;
    duringHour?: number;
    top?: number;
    position: 'LONG' | 'SHORT';
    slPercent: number;
}

@Injectable()
export class StrategyJob implements OnModuleInit {
    private readonly logger = new Logger(StrategyJob.name);

    constructor(
        private readonly bithumbOrderService: BithumbOrderService,
        private readonly bitgetOrderService: BitgetOrderService,
        private readonly notificationService: NotificationService,
        private readonly marketService: MarketService,
        private readonly schedulerRegistry: SchedulerRegistry,
        private readonly marketRepository: MarketRepository,
    ) {}

    onModuleInit() {
        if (process.env.NODE_ENV === 'production') {
            // --- Configuration Area ---
            this.holdHour({ hour: 5, second: 2, top: 1, askPercent: 0.1 });
            // this.bitgetHoldHour({ hour: 9, top: 1, position: 'LONG', slPercent: 0.05 });
        }
    }

    holdHour({ hour, second = 0, duringHour = 2, top = 1, askPercent }: HoldHourOptions) {
        console.log('holdHour options:', { hour, second, duringHour, top, askPercent });
        console.log('Current Process Time:', new Date().toString());

        let market: any;
        const jobNameBase = `holdHour-${hour}-${second}`;

        // 1. Buy & Sell Reserve Job (Combined)
        const buyAndSellJob = new CronJob(
            `${second} 1 ${hour} * * *`,
            async () => {
                console.log('buyAndSellJob triggered', new Date().toString());
                try {
                    // 1-1. Buy
                    market = await this.bithumbOrderService.bidBithumbTop(top);
                    this.logger.log(`${market.korean_name} 매수 완료`);
                    await this.notificationService.send(`${market.korean_name} 매수 완료`);

                    // 1-2. Wait 10 seconds
                    await new Promise((resolve) => setTimeout(resolve, 10000));

                    // 1-3. Sell Reserve
                    if (!!market?.market) {
                        const uuids = await this.bithumbOrderService.askBithumbLimit([market], askPercent, 'candle');
                        this.logger.log(`${uuids.join(', ')} 매도 예약 완료`);
                        await this.notificationService.send(`${uuids.join(', ')} 매도 예약 완료`);
                    }
                } catch (e: any) {
                    this.logger.error(e);
                    await this.notificationService.send(`매수/매도 예약 실패: ${e.message}`);
                }
            },
            null,
            false,
            'Asia/Seoul',
        );
        this.schedulerRegistry.addCronJob(`${jobNameBase}-buy-sell`, buyAndSellJob);
        buyAndSellJob.start();
        this.logger.log(`[${jobNameBase}-buy-sell] Next run: ${buyAndSellJob.nextDate().toString()}`);

        // 2. Force Sell Job
        const forceSellJob = new CronJob(
            `${second - 2} 1 ${(hour + duringHour) % 24} * * *`,
            async () => {
                try {
                    const waitingMarkets = await this.bithumbOrderService.deleteBithumbOrders();
                    const marketNames = waitingMarkets.map(({ market }: any) => market);

                    // Fallback: If no orders were cancelled but we have a market from buy job
                    if (market?.market && !marketNames.includes(market.market)) {
                        marketNames.push(market.market);
                    }

                    if (marketNames.length > 0) {
                        // Wait for balance update (latency)
                        await new Promise((resolve) => setTimeout(resolve, 1000));

                        await this.bithumbOrderService.askBithumbMarket(marketNames);
                        this.logger.log(`${marketNames.join(', ')} 매도 완료`);
                        await this.notificationService.send(`${marketNames.join(', ')} 매도 완료`);
                    }
                } catch (e: any) {
                    this.logger.error(e);
                    await this.notificationService.send(`매도 에러: ${e.message}`);
                }
            },
            null,
            false,
            'Asia/Seoul',
        );
        this.schedulerRegistry.addCronJob(`${jobNameBase}-forceSell`, forceSellJob);
        forceSellJob.start();
        this.logger.log(`[${jobNameBase}-forceSell] Next run: ${forceSellJob.nextDate().toString()}`);
    }

    bitgetHoldHour({ hour, second = 0, duringHour = 1, top = 1, position, slPercent }: BitgetHoldHourOptions) {
        let market: string;
        const jobNameBase = `bitgetHoldHour-${hour}-${second}`;

        // 1. Open Job
        const openJob = new CronJob(`${second} 1 ${hour} * * *`, async () => {
            try {
                const result = await this.bitgetOrderService.openBitgetMarket(top, position, slPercent);
                market = result.market;
                this.logger.log(`[Bitget] ${market} ${position} 진입 완료 (SL: ${slPercent * 100}%)`);
                await this.notificationService.send(`[Bitget] ${market} ${position} 진입 완료`);
            } catch (e: any) {
                this.logger.error(e);
                await this.notificationService.send(`[Bitget] 진입 실패: ${e.message}`);
            }
        });
        this.schedulerRegistry.addCronJob(`${jobNameBase}-open`, openJob);
        openJob.start();

        // 2. Force Close Job
        const forceCloseJob = new CronJob(`${second} 1 ${(hour + duringHour) % 24} * * *`, async () => {
            try {
                if (market) {
                    await this.bitgetOrderService.closeBitgetMarket(market);
                    this.logger.log(`[Bitget] ${market} 포지션 종료 완료`);
                    await this.notificationService.send(`[Bitget] ${market} 포지션 종료 완료`);
                }
            } catch (e: any) {
                this.logger.error(e);
                await this.notificationService.send(`[Bitget] 포지션 종료 실패: ${e.message}`);
            }
        });
        this.schedulerRegistry.addCronJob(`${jobNameBase}-close`, forceCloseJob);
        forceCloseJob.start();
    }
}
