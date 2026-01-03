import {
    getAllPosition,
    getAccount as getBitgetAccount,
    getTicker as getBitgetTicker,
    postOrder as postBitgetOrder,
    postFlashClosePosition,
    postLeverage,
} from '@/common/apis/bitget.api';
import {
    deleteOrder,
    getAccount as getBithumbAccount,
    getOrder as getBithumbOrder,
    getOrderList,
    postOrder as postBithumbOrder,
} from '@/common/apis/bithumb.api';
import { unitFloor as bitgetUnitFloor } from '@/common/utils/bitget.utils';
import { unitFloor as bithumbUnitFloor } from '@/common/utils/bithumb.utils';
import { MarketService } from '@/modules/market/market.service';
import { Injectable } from '@nestjs/common';

type MsgType = 'SHORT' | 'LONG' | 'S TP' | 'L TP' | 'S SL' | 'L SL';
type SideType = 'buy' | 'sell';

@Injectable()
export class OrderService {
    constructor(private readonly marketService: MarketService) {}

    // --- Bithumb Logic ---

    async bidBithumbTop(num: number) {
        const apiKey = process.env.API_KEY as string;
        const secret = process.env.SECRET_KEY as string;
        const markets = await this.marketService.getTop5Markets();

        const account = await getBithumbAccount({ apiKey, secret });
        const krw = account.find(({ currency }: any) => currency === 'KRW').balance;
        const krwPerMarket = Math.floor(krw);

        if (krwPerMarket < 5000) {
            throw { error: 'NOT_ENOUGH_KRW', message: 'KRW가 부족합니다.' };
        }

        const targetMarket = markets.at(num - 1) ?? { market: '' };
        const data = await getBithumbOrder({ market: targetMarket?.market, apiKey, secret });
        const bidFee = data?.bid_fee;
        const bidPrice = Math.floor(krwPerMarket) - Math.ceil(krwPerMarket * bidFee) - 1;

        await postBithumbOrder({
            market: targetMarket.market,
            side: 'bid',
            volume: '',
            price: `${bidPrice}`,
            ord_type: 'price',
            apiKey,
            secret,
        });
        return targetMarket;
    }

    async bidBithumbTop5() {
        const apiKey = process.env.API_KEY as string;
        const secret = process.env.SECRET_KEY as string;
        const markets = await this.marketService.getTop5Markets();

        const account = await getBithumbAccount({ apiKey, secret });
        const krw = account.find(({ currency }: any) => currency === 'KRW').balance;
        const krwPerMarket = Math.floor(krw / markets.length);

        if (krwPerMarket < 5000) {
            throw { error: 'NOT_ENOUGH_KRW', message: 'KRW가 부족합니다.' };
        }

        for (const { market } of markets) {
            const data = await getBithumbOrder({ market, apiKey, secret });
            const bidFee = data?.bid_fee;
            const bidPrice = Math.floor(krwPerMarket) - Math.ceil(krwPerMarket * bidFee) - 1;

            await postBithumbOrder({
                market,
                side: 'bid',
                volume: '',
                price: `${bidPrice}`,
                ord_type: 'price',
                apiKey,
                secret,
            });
        }
        return markets;
    }

    async askBithumbLimit(markets: any[], percent: number) {
        const apiKey = process.env.API_KEY as string;
        const secret = process.env.SECRET_KEY as string;
        const accounts = await getBithumbAccount({ apiKey, secret });
        const targetPercent = percent ?? 0.15;

        let uuids = [];
        for (const { market } of markets) {
            const avg_buy_price = accounts.find((el: any) => el.currency === market.split('-').at(1))?.avg_buy_price;
            const data = await getBithumbOrder({ market, apiKey, secret });

            const askOkBalance = Number(data?.ask_account?.balance);
            const price = `${bithumbUnitFloor(avg_buy_price * (1 + targetPercent))}`;

            if (askOkBalance === 0) {
                throw { error: 'NOT_BALANCE', message: '보유하지 않았습니다.' };
            }

            const orderData = await postBithumbOrder({
                market,
                side: 'ask',
                volume: `${askOkBalance}`,
                price: price,
                ord_type: 'limit',
                apiKey,
                secret,
            });
            uuids.push(orderData.uuid);
        }
        return uuids;
    }

    async deleteBithumbOrders() {
        const apiKey = process.env.API_KEY as string;
        const secret = process.env.SECRET_KEY as string;

        const data = await getOrderList({ apiKey, secret });
        let markets = [];
        for (const { uuid } of data) {
            const order = await deleteOrder({ uuid, apiKey, secret });
            markets.push(order);
        }
        return markets;
    }

    async askBithumbMarket(markets: any[]) {
        const apiKey = process.env.API_KEY as string;
        const secret = process.env.SECRET_KEY as string;

        for (const market of markets) {
            const data = await getBithumbOrder({ market, apiKey, secret });
            const askOkBalance = Number(data?.ask_account?.balance);

            if (askOkBalance === 0) {
                throw { error: 'NOT_BALANCE', message: '보유하지 않았습니다.' };
            }
            await postBithumbOrder({
                market,
                side: 'ask',
                volume: `${askOkBalance}`,
                price: ``,
                ord_type: 'market',
                apiKey,
                secret,
            });
        }
        return {};
    }

    // --- Bitget Logic ---

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
            const formattedSize = Math.floor(size * 10000) / 10000; // 소수점 4자리 버림

            await postBitgetOrder({
                symbol: blockchainSymbol,
                productType: 'USDT-FUTURES',
                marginMode: 'crossed',
                marginCoin: 'USDT',
                size: `${formattedSize}`,
                side: side,
                tradeSide: 'open',
                orderType: 'market',
                presetStopLossPrice: `${bitgetUnitFloor(orderPrice * (1 + lossPercent))}`,
            });
        }
        return { result: 'ok' };
    }
}
