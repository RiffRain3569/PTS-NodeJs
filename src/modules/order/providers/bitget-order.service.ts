import {
    getAllPosition,
    getAccount as getBitgetAccount,
    getContracts as getBitgetContracts,
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

    async openBitgetMarket(rank: number, position: 'LONG' | 'SHORT', slPercent?: number) {
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
            leverage: '1',
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

        // Fetch contract details to safely format size
        const contractRes = await getBitgetContracts({ symbol: blockchainSymbol, productType: 'USDT-FUTURES' });
        const contractInfo = contractRes.data[0];
        const sizeMultiplier = Number(contractInfo?.sizeMultiplier || 1);
        const volumePlace = Number(contractInfo?.volumePlace || 4);

        // Market orders require a buffer margin (~5%). Use 95% of available balance.
        let inputMargin = crossedMaxAvailable * 0.95;
        const minOrderValue = 5.5;

        if (inputMargin * leverage < minOrderValue) {
            const requiredMargin = minOrderValue / leverage;
            inputMargin = crossedMaxAvailable >= requiredMargin ? requiredMargin : crossedMaxAvailable * 0.99;
        }

        let size = (inputMargin * leverage) / orderPrice;

        // Ensure size is a multiple of sizeMultiplier and follows volumePlace
        size = Math.floor(size / sizeMultiplier) * sizeMultiplier;
        const formattedSize = Number(size.toFixed(volumePlace));

        if (formattedSize <= 0) {
            throw new Error(`Calculated size is too small: ${formattedSize}`);
        }

        // 5. Calculate Stop Loss Price
        let stopLossPrice;
        if (slPercent !== undefined) {
            // User Input (ROE) -> Price Movement (ROA) conversion
            // ROA = ROE / Leverage
            const roaSlPercent = slPercent / leverage;
            // LONG: Entry * (1 - ROA), SHORT: Entry * (1 + ROA)
            stopLossPrice = side === 'buy' ? orderPrice * (1 - roaSlPercent) : orderPrice * (1 + roaSlPercent);
        }

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
            ...(stopLossPrice !== undefined && { presetStopLossPrice: `${bitgetUnitFloor(stopLossPrice)}` }),
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

            // 추가: Contract 정보 불러와서 size 기준 적용 (지수화 및 소수점)
            const contractRes = await getBitgetContracts({ symbol: blockchainSymbol, productType: 'USDT-FUTURES' });
            const contractInfo = contractRes.data[0];
            const sizeMultiplier = Number(contractInfo?.sizeMultiplier || 1);
            const volumePlace = Number(contractInfo?.volumePlace || 4);

            // 시장가 주문 시 슬리피지/마진을 대비해 가용 마진의 95%만 사용
            let inputMargin = crossedMaxAvailable * 0.95;
            const minOrderValue = 5.5; // 최소 주문 가치 (여유있게 5.5)

            // 주문 가치가 최소값보다 작으면 마진을 조정
            if (inputMargin * leverage < minOrderValue) {
                const requiredMargin = minOrderValue / leverage;
                // 잔고가 충분하면 최소 마진으로 설정, 부족하면 전액(99%) 사용 (API 에러 발생 가능성 있음)
                inputMargin = crossedMaxAvailable >= requiredMargin ? requiredMargin : crossedMaxAvailable * 0.99;
            }

            let size = (inputMargin * leverage) / orderPrice;

            // sizeMultiplier 배수 적용 및 소수점 자리(volumePlace) 제한
            size = Math.floor(size / sizeMultiplier) * sizeMultiplier;
            const formattedSize = Number(size.toFixed(volumePlace));

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
