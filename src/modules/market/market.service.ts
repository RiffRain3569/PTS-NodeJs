import { getSpotTickers } from '@/common/apis/bitget.api';
import { getMarket, getTicker } from '@/common/apis/bithumb.api';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MarketService {
    async getTop5Markets() {
        const markets = (await getMarket({})).filter((el: any) => el.market.split('-').at(0) === 'KRW');
        const mid = Math.ceil(markets.length / 2); // 홀수도 고려해서 ceil 사용

        // 길이 오류 때문에 분리
        const tickers1 = await getTicker({
            markets: (markets.slice(0, mid) || []).map((coin: any) => coin.market).join(','),
        });
        const tickers2 = await getTicker({ markets: (markets.slice(mid) || []).map((coin: any) => coin.market).join(',') });
        const ignoreMarkets = ['KRW-NFT', 'KRW-BTT', 'KRW-USDT', 'KRW-USDC'];

        const mergedList = Object.values(
            [...markets, ...tickers1, ...tickers2].reduce((acc: any, item: any) => {
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
    }

    async getBitgetTop5Markets() {
        const response = await getSpotTickers();
        if (response.code !== '00000') {
            throw new Error(response.msg || 'Bitget API Error');
        }

        const markets = response.data;
        const usdtMarkets = markets.filter((m: any) => m.symbol.endsWith('USDT'));

        const sortedList = usdtMarkets.sort((a: any, b: any) => {
            return parseFloat(b.changeUtc24h) - parseFloat(a.changeUtc24h);
        });

        return sortedList.slice(0, 5).map((m: any) => {
             return {
                market: m.symbol,
                trade_price: m.lastPr,
                change_rate: `${(parseFloat(m.changeUtc24h) * 100).toFixed(2)}%`,
            };
        });
    }
}

export const marketService = new MarketService();
