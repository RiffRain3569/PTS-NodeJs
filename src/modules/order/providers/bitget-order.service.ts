import {
    getAllPosition,
    getAccount as getBitgetAccount,
    getTicker as getBitgetTicker,
    postOrder as postBitgetOrder,
    postFlashClosePosition,
    postLeverage,
} from '@/common/apis/bitget.api';
import { unitFloor as bitgetUnitFloor } from '@/common/utils/bitget.utils';
import { MarketService } from '@/modules/market/market.service';
import { Injectable } from '@nestjs/common';

type MsgType = 'SHORT' | 'LONG' | 'S TP' | 'L TP' | 'S SL' | 'L SL';
type SideType = 'buy' | 'sell';

@Injectable()
export class BitgetOrderService {
    constructor(private readonly marketService: MarketService) {}

    async openBitgetMarket(rank: number, position: 'LONG' | 'SHORT', slPercent: number) {
        // 1. Get Market Info
        const markets = await this.marketService.getBitgetTop5Markets();
        const targetMarket = markets.at(rank - 1);

        if (!targetMarket) {
            throw new Error(`Rank ${rank} market not found`);
        }
        const blockchainSymbol = targetMarket.market;

        // 2. Set Leverage
        await postLeverage({
            symbol: blockchainSymbol,
            productType: 'USDT-FUTURES',
            marginCoin: 'USDT',
            leverage: '3',
        });

        // 3. Get Price & Account Info
        const ticker = await getBitgetTicker({
            symbol: blockchainSymbol,
            productType: 'USDT-FUTURES',
        });

        const account = await getBitgetAccount({
            symbol: blockchainSymbol,
            productType: 'USDT-FUTURES',
            marginCoin: 'USDT',
        });

        const crossedMaxAvailable = Number(account?.data?.crossedMaxAvailable || 0);
        const leverage = Number(account?.data?.crossedMarginLeverage || 1);
        const bidPrice = Number(ticker.data[0]?.bidPr);
        const askPrice = Number(ticker.data[0]?.askPr);

        // 4. Calculate Size & Price
        const side: SideType = position === 'SHORT' ? 'sell' : 'buy';
        const orderPrice = side === 'sell' ? askPrice : bidPrice;

        // Minimum order value logic (ensure > 5 USDT)
        let inputMargin = crossedMaxAvailable - 2; // buffer 2 USDT
        const minOrderValue = 5.5;

        if (inputMargin * leverage < minOrderValue) {
            const requiredMargin = minOrderValue / leverage;
            inputMargin = crossedMaxAvailable >= requiredMargin ? requiredMargin : crossedMaxAvailable;
        }

        const size = (inputMargin * leverage) / orderPrice;
        const formattedSize = Math.floor(size * 1000000) / 1000000;

        if (formattedSize <= 0) {
            throw new Error(`Calculated size is too small: ${formattedSize}`);
        }

        // 5. Calculate Stop Loss Price
        // User Input (ROE) -> Price Movement (ROA) conversion
        // ROA = ROE / Leverage
        const roaSlPercent = slPercent / leverage;

        // LONG: Entry * (1 - ROA), SHORT: Entry * (1 + ROA)
        const stopLossPrice = side === 'buy' ? orderPrice * (1 - roaSlPercent) : orderPrice * (1 + roaSlPercent);

        // 6. Place Order
        await postBitgetOrder({
            symbol: blockchainSymbol,
            productType: 'USDT-FUTURES',
            marginMode: 'crossed',
            marginCoin: 'USDT',
            size: `${formattedSize}`,
            side: side,
            tradeSide: 'open',
            orderType: 'market',
            presetStopLossPrice: `${bitgetUnitFloor(stopLossPrice)}`,
        });

        return { market: blockchainSymbol };
    }

    async closeBitgetMarket(market: string) {
        await postFlashClosePosition({
            symbol: market,
            productType: 'USDT-FUTURES',
        });
    }

    async handleBitgetSignal(blockchainSymbol: string, message: MsgType) {
        // 현재 포지션 정보 조회
        const allPosition = await getAllPosition({
            productType: 'USDT-FUTURES',
            marginCoin: 'USDT',
        });

        await postLeverage({
            symbol: blockchainSymbol,
            productType: 'USDT-FUTURES',
            marginCoin: 'USDT',
            leverage: '3',
        });

        // 익절, 손절 메시지 처리
        if (
            message === 'S TP' ||
            message === 'L TP' ||
            message === 'S SL' ||
            message === 'L SL' ||
            (message === 'SHORT' && allPosition?.data[0]?.holdSide === 'long') || // 롱 포지션이 있는 경우 반대 포지션 시그널
            (message === 'LONG' && allPosition?.data[0]?.holdSide === 'short') // 숏 포지션이 있는 경우 반대 포지션 시그널
        ) {
            await postFlashClosePosition({
                symbol: blockchainSymbol,
                productType: 'USDT-FUTURES',
            }).catch(() => {});
        }

        // SHORT, LONG 시그널 발생 시 포지션 오픈
        if (message === 'SHORT' || message === 'LONG') {
            const ticker = await getBitgetTicker({
                symbol: blockchainSymbol,
                productType: 'USDT-FUTURES',
            });

            const account = await getBitgetAccount({
                symbol: blockchainSymbol,
                productType: 'USDT-FUTURES',
                marginCoin: 'USDT',
            });

            // const availableBalance = Math.floor(Number(account?.data?.crossedMaxAvailable)) - 2;
            const crossedMaxAvailable = Number(account?.data?.crossedMaxAvailable || 0);
            const leverage = Number(account?.data?.crossedMarginLeverage || 1);
            const bidPrice = Number(ticker.data[0]?.bidPr);
            const askPrice = Number(ticker.data[0]?.askPr);
            const lossPercent = 0.1;

            // 동일 포지션이면 추가 주문
            const side: SideType = message === 'SHORT' ? 'sell' : 'buy';
            const orderPrice = side === 'sell' ? askPrice : bidPrice;

            // 최소 주문 금액 5USDT 보장 로직
            let inputMargin = crossedMaxAvailable - 2; // 여유버퍼 2USDT
            const minOrderValue = 5.5; // 최소 주문 가치 (여유있게 5.5)

            // 주문 가치가 최소값보다 작으면 마진을 조정
            if (inputMargin * leverage < minOrderValue) {
                const requiredMargin = minOrderValue / leverage;
                // 잔고가 충분하면 최소 마진으로 설정, 부족하면 전액 사용 (API 에러 발생 가능성 있음)
                inputMargin = crossedMaxAvailable >= requiredMargin ? requiredMargin : crossedMaxAvailable;
            }

            const size = (inputMargin * leverage) / orderPrice;
            const formattedSize = Math.floor(size * 1000000) / 1000000; // 소수점 6자리 버림

            if (formattedSize <= 0) {
                console.error(`[Bitget Order Error] Calculated size is 0 or less. skipping.`);
                return { result: 'fail', message: 'Size too small' };
            }

            // 손절가 계산 (LONG: 진입가보다 낮게, SHORT: 진입가보다 높게)
            const stopLossPrice = side === 'buy' ? orderPrice * (1 - lossPercent) : orderPrice * (1 + lossPercent);

            await postBitgetOrder({
                symbol: blockchainSymbol,
                productType: 'USDT-FUTURES',
                marginMode: 'crossed',
                marginCoin: 'USDT',
                size: `${formattedSize}`,
                side: side,
                tradeSide: 'open',
                orderType: 'market',
                presetStopLossPrice: `${bitgetUnitFloor(stopLossPrice)}`,
            });
        }
        return { result: 'ok' };
    }
}
