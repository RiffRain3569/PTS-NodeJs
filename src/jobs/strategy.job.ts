import { MarketService } from '@/modules/market/market.service';
import { NotificationService } from '@/modules/notification/notification.service';
import { OrderService } from '@/modules/order/order.service';
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

@Injectable()
export class StrategyJob implements OnModuleInit {
    private readonly logger = new Logger(StrategyJob.name);

    constructor(
        private readonly orderService: OrderService,
        private readonly notificationService: NotificationService,
        private readonly marketService: MarketService,
        private readonly schedulerRegistry: SchedulerRegistry,
    ) {}

    onModuleInit() {
        if (process.env.NODE_ENV === 'production') {
            // --- Configuration Area ---
            this.holdHour({ hour: 5, second: 2, top: 1, askPercent: 0.1 });
        } else {
            this.test();
        }
    }

    async test() {
        console.log(await this.marketService.getBitgetTop5Markets());
    }

    holdHour({ hour, second = 0, duringHour = 2, top = 1, askPercent }: HoldHourOptions) {
        let market: any;
        const jobNameBase = `holdHour-${hour}-${second}`;

        // 1. Buy & Sell Reserve Job (Combined)
        const buyAndSellJob = new CronJob(`${second} 1 ${hour} * * *`, async () => {
            try {
                // 1-1. Buy
                market = await this.orderService.bidBithumbTop(top);
                this.logger.log(`${market.korean_name} 매수 완료`);
                await this.notificationService.send(`${market.korean_name} 매수 완료`);

                // 1-2. Wait 5 seconds
                await new Promise((resolve) => setTimeout(resolve, 5000));

                // 1-3. Sell Reserve
                if (!!market?.market) {
                    const uuids = await this.orderService.askBithumbLimit([market], askPercent);
                    this.logger.log(`${uuids.join(', ')} 매도 예약 완료`);
                    await this.notificationService.send(`${uuids.join(', ')} 매도 예약 완료`);
                }
            } catch (e: any) {
                this.logger.error(e);
                await this.notificationService.send(`매수/매도 예약 실패: ${e.message}`);
            }
        });
        this.schedulerRegistry.addCronJob(`${jobNameBase}-buy-sell`, buyAndSellJob);
        buyAndSellJob.start();

        // 2. Force Sell Job
        const forceSellJob = new CronJob(`${second} 1 ${(hour + duringHour) % 24} * * *`, async () => {
            try {
                const waitingMarkets = await this.orderService.deleteBithumbOrders();
                const marketNames = waitingMarkets.map(({ market }: any) => market);

                // Fallback: If no orders were cancelled but we have a market from buy job
                if (market?.market && !marketNames.includes(market.market)) {
                    marketNames.push(market.market);
                }

                if (marketNames.length > 0) {
                    // Wait for balance update (latency)
                    await new Promise((resolve) => setTimeout(resolve, 1000));

                    await this.orderService.askBithumbMarket(marketNames);
                    this.logger.log(`${marketNames.join(', ')} 매도 완료`);
                    await this.notificationService.send(`${marketNames.join(', ')} 매도 완료`);
                }
            } catch (e: any) {
                this.logger.error(e);
                await this.notificationService.send(`매도 에러: ${e.message}`);
            }
        });
        this.schedulerRegistry.addCronJob(`${jobNameBase}-forceSell`, forceSellJob);
        forceSellJob.start();
    }

    private activeBitgetTrade: { market: string; position: 'LONG' | 'SHORT' } | null = null;

    // 매 시 1분 6초에 실행
    // @Cron('6 1 * * * *')
    async handleBitgetStrategy() {
        if (process.env.NODE_ENV !== 'production') return;

        // 설정값
        const position = 'LONG';
        const jobId = `bitget-${Date.now()}`;

        try {
            // 1. Close Previous Position (if exists)
            if (this.activeBitgetTrade) {
                const { market: prevMarket, position: prevPosition } = this.activeBitgetTrade;
                try {
                    const closeMsg = prevPosition === 'SHORT' ? 'S TP' : 'L TP';
                    await this.orderService.handleBitgetSignal(prevMarket, closeMsg);
                    this.logger.log(`[${jobId}] bitget ${prevMarket} 포지션 클로즈 (Sequential)`);
                    await this.notificationService.send(`bitget ${prevMarket} 포지션 클로즈`);
                } catch (error: any) {
                    await this.notificationService.send(`bitget ${prevMarket} 청산 에러`);
                    this.logger.error(error);
                } finally {
                    this.activeBitgetTrade = null;
                }
            }

            // 2. Open New Position
            const markets = await this.marketService.getBitgetTop5Markets();
            let openedMarket = '';

            for (const targetMarket of markets) {
                const market = targetMarket.market;
                try {
                    await this.orderService.handleBitgetSignal(market, position);
                    this.logger.log(`[${jobId}] bitget ${market} ${position} 포지션 오픈`);
                    await this.notificationService.send(`bitget ${market} ${position} 포지션 오픈`);
                    openedMarket = market;
                    break;
                } catch (e: any) {
                    await this.notificationService.send(`bitget ${market} ${position} 진입 에러: ${e.message}`);
                    this.logger.error(e);
                }
            }

            if (openedMarket) {
                this.activeBitgetTrade = { market: openedMarket, position };
            }
        } catch (e: any) {
            this.logger.error(e);
            await this.notificationService.send(`Strategy Job Error: ${e.message}`);
        }
    }
}
