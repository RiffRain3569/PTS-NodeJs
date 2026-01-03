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

            this.holdHourBitget({ hour: 1, second: 6, duringHour: 1, askPercent: 0.1, position: 'SHORT' });
            this.holdHourBitget({ hour: 2, second: 6, duringHour: 1, askPercent: 0.1, position: 'SHORT' });
            this.holdHourBitget({ hour: 3, second: 6, duringHour: 1, askPercent: 0.1, position: 'SHORT' });
            this.holdHourBitget({ hour: 4, second: 6, duringHour: 1, askPercent: 0.1, position: 'SHORT' });
            this.holdHourBitget({ hour: 5, second: 6, duringHour: 1, askPercent: 0.1, position: 'SHORT' });
            this.holdHourBitget({ hour: 6, second: 6, duringHour: 1, askPercent: 0.1, position: 'SHORT' });
            this.holdHourBitget({ hour: 7, second: 6, duringHour: 1, askPercent: 0.1, position: 'SHORT' });
            this.holdHourBitget({ hour: 8, second: 6, duringHour: 1, askPercent: 0.1, position: 'SHORT' });
            this.holdHourBitget({ hour: 9, second: 6, duringHour: 1, askPercent: 0.1, position: 'SHORT' });
            this.holdHourBitget({ hour: 10, second: 6, duringHour: 1, askPercent: 0.1, position: 'SHORT' });
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

        // 1. Buy Job
        const buyJob = new CronJob(`${second} 1 ${hour} * * *`, async () => {
            try {
                market = await this.orderService.bidBithumbTop(top);
                this.logger.log(`${market.korean_name} 매수 완료`);
                await this.notificationService.send(`${market.korean_name} 매수 완료`);
            } catch (e: any) {
                this.logger.error(e);
                await this.notificationService.send(`매수 실패: ${e.message}`);
            }
        });
        this.schedulerRegistry.addCronJob(`${jobNameBase}-buy`, buyJob);
        buyJob.start();

        // 2. Sell Reserve Job
        const sellJob = new CronJob(`${second + 5} 1 ${hour} * * *`, async () => {
            try {
                if (!!market?.market) {
                    const uuids = await this.orderService.askBithumbLimit([market], askPercent);
                    this.logger.log(`${uuids.join(', ')} 매도 예약 완료`);
                    await this.notificationService.send(`${uuids.join(', ')} 매도 예약 완료`);
                }
            } catch (e: any) {
                this.logger.error(e);
                await this.notificationService.send(`지정가 에러: ${e.message}`);
            }
        });
        this.schedulerRegistry.addCronJob(`${jobNameBase}-sell`, sellJob);
        sellJob.start();

        // 3. Force Sell Job
        const forceSellJob = new CronJob(`${second} 1 ${(hour + duringHour) % 24} * * *`, async () => {
            try {
                const waitingMarkets = await this.orderService.deleteBithumbOrders();
                if (waitingMarkets.length > 0) {
                     const marketNames = waitingMarkets.map(({ market }: any) => market);
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

    holdHourBitget({ hour, second = 0, duringHour = 2, position = 'SHORT' }: HoldHourOptions) {
        let market: string;
        const jobNameBase = `bitget-${hour}-${second}`;

        // 1. Open Position
        const openJob = new CronJob(`${second} 1 ${hour} * * *`, async () => {
            try {
                const markets = await this.marketService.getTop5Markets();
                for (const targetMarket of markets) {
                    market = targetMarket.market.replace('KRW-', '') + 'USDT';
                    try {
                        // Pass position string as MsgType
                        await this.orderService.handleBitgetSignal(market, position as any);
                        await this.notificationService.send(`bitget ${market} ${position} 포지션 오픈`);
                        break; 
                    } catch (e: any) { 
                        await this.notificationService.send(`bitget ${market} ${position} 매수 에러`);
                        this.logger.error(e);
                    }
                }
            } catch (e: any) { this.logger.error(e); }
        });
        this.schedulerRegistry.addCronJob(`${jobNameBase}-open`, openJob);
        openJob.start();

        // 2. Close Position
        const closeJob = new CronJob(`${second - 2} 1 ${(hour + duringHour) % 24} * * *`, async () => {
             try {
                const closeMsg = position === 'SHORT' ? 'S TP' : 'L TP';
                await this.orderService.handleBitgetSignal(market, closeMsg); 
                await this.notificationService.send(`bitget ${market} 포지션 클로즈`);
            } catch (error: any) {
                await this.notificationService.send(`bitget ${market} 매도 에러`);
                this.logger.error(error);
            }
        });
        this.schedulerRegistry.addCronJob(`${jobNameBase}-close`, closeJob);
        closeJob.start();
    }
}
