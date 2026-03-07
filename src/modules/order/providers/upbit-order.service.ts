import {
    deleteUpbitOrder,
    getUpbitAccount,
    getUpbitCandles,
    getUpbitOrderChance,
    getUpbitOrderList,
    postUpbitOrder,
} from '@/common/apis/upbit.api';
import { unitFloor as upbitUnitFloor } from '@/common/utils/upbit.utils';
import { MarketService } from '@/modules/market/market.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UpbitOrderService {
    constructor(private readonly marketService: MarketService) {}

    async bidUpbitTop(num: number) {
        const markets = await this.marketService.getUpbitTop5Markets();

        const account = await getUpbitAccount();
        const krw = Number(account.find(({ currency }: any) => currency === 'KRW')?.balance || 0);
        const krwPerMarket = Math.floor(krw);

        if (krwPerMarket < 5000) {
            throw { error: 'NOT_ENOUGH_KRW', message: 'KRW가 부족합니다.' };
        }

        const targetMarket = markets.at(num - 1) ?? { market: '' };
        if (!targetMarket.market) {
            throw { error: 'NOT_FOUND_MARKET', message: '마켓을 찾을 수 없습니다.' };
        }

        const chance = await getUpbitOrderChance({ market: targetMarket.market });
        const bidFee = Number(chance?.bid_fee || 0.0005);
        const bidPrice = Math.floor(krwPerMarket) - Math.ceil(krwPerMarket * bidFee) - 1;

        await postUpbitOrder({
            market: targetMarket.market,
            side: 'bid',
            volume: '',
            price: `${bidPrice}`,
            ord_type: 'price',
        });
        return targetMarket;
    }

    async bidUpbitTop5() {
        const markets = await this.marketService.getUpbitTop5Markets();

        const account = await getUpbitAccount();
        const krw = Number(account.find(({ currency }: any) => currency === 'KRW')?.balance || 0);
        const krwPerMarket = Math.floor(krw / markets.length);

        if (krwPerMarket < 5000) {
            throw { error: 'NOT_ENOUGH_KRW', message: 'KRW가 부족합니다.' };
        }

        for (const { market } of markets) {
            const chance = await getUpbitOrderChance({ market });
            const bidFee = Number(chance?.bid_fee || 0.0005);
            const bidPrice = Math.floor(krwPerMarket) - Math.ceil(krwPerMarket * bidFee) - 1;

            await postUpbitOrder({
                market,
                side: 'bid',
                volume: '',
                price: `${bidPrice}`,
                ord_type: 'price',
            });
        }
        return markets;
    }

    async askUpbitLimit(markets: any[], percent: number, type: 'avg' | 'candle' = 'avg') {
        const accounts = await getUpbitAccount();
        const targetPercent = percent ?? 0.15;

        let uuids = [];
        for (const marketObj of markets) {
            const market = marketObj.market || marketObj;
            let basisPrice = 0;
            if (type === 'avg') {
                basisPrice = Number(
                    accounts.find((el: any) => el.currency === market.split('-').at(1))?.avg_buy_price || 0,
                );
            } else {
                const candles = await getUpbitCandles(market, 1, 2);
                // @ts-ignore
                basisPrice = candles.at(1)?.trade_price || 0;
            }

            const chance = await getUpbitOrderChance({ market });

            const askOkBalance = Number(chance?.ask_account?.balance || 0);
            const price = `${upbitUnitFloor(basisPrice * (1 + targetPercent))}`;

            if (askOkBalance === 0) {
                throw { error: 'NOT_BALANCE', message: '보유하지 않았습니다.' };
            }

            const orderData = await postUpbitOrder({
                market,
                side: 'ask',
                volume: `${askOkBalance}`,
                price: price,
                ord_type: 'limit',
            });
            uuids.push(orderData.uuid);
        }
        return uuids;
    }

    async deleteUpbitOrders() {
        const data = await getUpbitOrderList({ state: 'wait' });
        let markets = [];
        for (const { uuid } of data) {
            const order = await deleteUpbitOrder({ uuid });
            markets.push(order);
        }
        return markets;
    }

    async askUpbitMarket(markets: any[]) {
        const accounts = await getUpbitAccount();

        for (const market of markets) {
            const currency = market.split('-').at(1);
            const account = accounts.find((el: any) => el.currency === currency);
            const askOkBalance = Number(account?.balance || 0);

            if (askOkBalance === 0) {
                throw { error: 'NOT_BALANCE', message: '보유하지 않았습니다.' };
            }
            await postUpbitOrder({
                market,
                side: 'ask',
                volume: `${askOkBalance}`,
                price: ``,
                ord_type: 'market',
            });
        }
        return {};
    }
}
