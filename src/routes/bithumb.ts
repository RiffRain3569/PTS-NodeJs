import {
    deleteOrder,
    getAccount,
    getMarket,
    getOrder,
    getOrderList,
    getTicker,
    postOrder,
} from '@/global/apis/bithumb';
import { unitFloor } from '@/global/utils/bithumb';
import { Router } from 'express';

const router = Router();

router.get('/market/top5', async (req, res) => {
    res.json(await getMarkets());
});

router.post('/order/bid/top5', async (req, res) => {
    const apiKey = process.env.API_KEY as string;
    const secret = process.env.SECRET_KEY as string;
    const markets = await getMarkets();

    const krw = (await getAccount({ apiKey, secret })).find(({ currency }: any) => currency === 'KRW').balance;

    const krwPerMarket = Math.floor(krw / markets.length);

    if (krwPerMarket < 5000) {
        throw { error: 'NOT_ENOUGH_KRW', message: 'KRW가 부족합니다.' };
    }
    for (const { market } of markets) {
        const data = await getOrder({ market, apiKey, secret });

        const bidFee = data?.bid_fee;

        const bidPrice = Math.floor(krwPerMarket) - Math.ceil(krwPerMarket * bidFee) - 1;
        await postOrder({
            market,
            side: 'bid',
            volume: '',
            price: `${bidPrice}`,
            ord_type: 'price',
            apiKey,
            secret,
        });
    }
    res.json(markets);
});

router.post('/order/ask/limit', async (req, res) => {
    const apiKey = process.env.API_KEY as string;
    const secret = process.env.SECRET_KEY as string;
    const markets = req.body.markets;

    let uuids = [];
    for (const { market, trade_price } of markets) {
        const data = await getOrder({ market, apiKey, secret });

        const askOkBalance = Number(data?.ask_account?.balance);
        const price = `${unitFloor(trade_price * 1.15)}`;

        const askVolume = askOkBalance;
        if (askOkBalance === 0) {
            throw { error: 'NOT_BALANCE', message: '보유하지 않았습니다.' };
        }
        const orderData = await postOrder({
            market,
            side: 'ask',
            volume: `${askVolume}`,
            price: price,
            ord_type: 'limit',
            apiKey,
            secret,
        });
        uuids.push(orderData.uuid);
    }

    res.json(uuids);
});

router.delete('/order', async (req, res) => {
    const apiKey = process.env.API_KEY as string;
    const secret = process.env.SECRET_KEY as string;

    const data = await getOrderList({ apiKey, secret });
    let markets = [];
    for (const { uuid } of data) {
        const order = await deleteOrder({ uuid, apiKey, secret });
        markets.push(order);
    }
    res.json(markets);
});

router.post('/order/ask', async (req, res) => {
    const apiKey = process.env.API_KEY as string;
    const secret = process.env.SECRET_KEY as string;
    const markets = req.body.markets;

    for (const market of markets) {
        const data = await getOrder({ market, apiKey, secret });

        const askOkBalance = Number(data?.ask_account?.balance);

        const askVolume = askOkBalance;
        if (askOkBalance === 0) {
            throw { error: 'NOT_BALANCE', message: '보유하지 않았습니다.' };
        }
        await postOrder({
            market,
            side: 'ask',
            volume: `${askVolume}`,
            price: ``,
            ord_type: 'market',
            apiKey,
            secret,
        });
    }

    res.json({});
});

export default router;

const getMarkets = async () => {
    const markets = (await getMarket({})).filter((el: any) => el.market.split('-').at(0) === 'KRW');
    const tickers = await getTicker({ markets: (markets || []).map((coin: any) => coin.market).join(',') });
    const ignoreMarkets = ['KRW-NFT', 'KRW-BTT', 'KRW-USDT', 'KRW-USDC'];

    const mergedList = Object.values(
        [...markets, ...tickers].reduce((acc, item) => {
            acc[item.market] = { ...acc[item.market], ...item };
            return acc;
        }, {})
    ).filter((el: any) => !ignoreMarkets.includes(el.market));

    const sortedList = mergedList.sort((a: any, b: any) => b.signed_change_rate - a.signed_change_rate);

    return sortedList
        .map(({ market, korean_name, trade_price, change_rate }: any) => ({
            market,
            korean_name,
            trade_price,
            change_rate: `${Math.floor(change_rate * 10000) / 100}%`,
        }))
        .splice(0, 5);
};
