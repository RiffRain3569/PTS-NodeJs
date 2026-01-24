import {
    deleteOrder,
    getAccount as getBithumbAccount,
    getOrder as getBithumbOrder,
    getOrderList,
    postOrder as postBithumbOrder,
} from '@/common/apis/bithumb.api';
import { unitFloor as bithumbUnitFloor } from '@/common/utils/bithumb.utils';
import { MarketService } from '@/modules/market/market.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class BithumbOrderService {
    constructor(private readonly marketService: MarketService) {}

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
}
