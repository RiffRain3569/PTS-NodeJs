import { getMarket, getTicker } from '@/apis/bithumb';
import { Router } from 'express';

const router = Router();

router.get('/market/top5', async (req, res) => {
    const markets = (await getMarket({})).filter((el: any) => el.market.split('-').at(0) === 'KRW');
    const tickers = await getTicker({ markets: (markets || []).map((coin: any) => coin.market).join(',') });

    const mergedList = Object.values(
        [...markets, ...tickers].reduce((acc, item) => {
            acc[item.market] = { ...acc[item.market], ...item };
            return acc;
        }, {})
    ).filter((el: any) => el.market !== 'KRW-NFT' && el.market !== 'KRW-BTT');

    const sortedList = mergedList.sort((a: any, b: any) => b.signed_change_rate - a.signed_change_rate);

    const result = sortedList
        .map(({ market, korean_name, trade_price, change_rate }: any) => ({
            market,
            korean_name,
            trade_price,
            change_rate: `${Math.floor(change_rate * 10000) / 100}%`,
        }))
        .splice(0, 5);
    console.log(result);

    res.json(result);
});

router.post('/market/ask', (req, res) => {
    res.json({ message: 'API 데이터' });
});

export default router;
