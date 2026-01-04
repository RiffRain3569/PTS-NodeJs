import { MarketService } from '@/modules/market/market.service';
import { NotificationService } from '@/modules/notification/notification.service';
import { OrderService } from '@/modules/order/order.service';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
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
        private readonly schedulerRegistry: SchedulerRegistry
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

    // 매 시 1분 6초에 실행
    @Cron('6 1 * * * *')
    async handleBitgetStrategy() {
        if (process.env.NODE_ENV !== 'production') return;
        // 설정값 (추후 DB화 가능)
        const position = 'SHORT';
        const duringHour = 1;

        const jobId = `bitget-${Date.now()}`;
        let market: string = '';

        try {
            // 1. Open Logic
            const markets = await this.marketService.getBitgetTop5Markets();
            for (const targetMarket of markets) {
                market = targetMarket.market;
                try {
                    await this.orderService.handleBitgetSignal(market, position);
                    this.logger.log(`[${jobId}] bitget ${market} ${position} 포지션 오픈`);
                    await this.notificationService.send(`bitget ${market} ${position} 포지션 오픈`);
                    break;
                } catch (e: any) {
                    await this.notificationService.send(`bitget ${market} ${position} 진입 에러: ${e.message}`);
                    this.logger.error(e);
                }
            }

            if (!market) return; // 진입 실패시 종료

            // 2. Schedule Close Logic (Dynamic)
            // duringHour 시간 뒤에 실행 (ms 단위 변환)
            const closeDelay = duringHour * 60 * 60 * 1000 - 2000; // 2초 먼저 실행 (기존 로직 유지)

            const closeTimeout = setTimeout(async () => {
                try {
                    const closeMsg = position === 'SHORT' ? 'S TP' : 'L TP';
                    await this.orderService.handleBitgetSignal(market, closeMsg);
                    this.logger.log(`[${jobId}] bitget ${market} 포지션 클로즈`);
                    await this.notificationService.send(`bitget ${market} 포지션 클로즈`);
                } catch (error: any) {
                    await this.notificationService.send(`bitget ${market} 청산 에러`);
                    this.logger.error(error);
                } finally {
                    // 메모리 해제 확인 등 필요한 경우 처리 (Timer는 자동 해제됨)
                }
            }, closeDelay);

            // SchedulerRegistry에 등록하여 관리 (선택 사항, 필요시 취소 가능하도록)
            this.schedulerRegistry.addTimeout(`${jobId}-close`, closeTimeout);
        } catch (e: any) {
            this.logger.error(e);
        }
    }
}
