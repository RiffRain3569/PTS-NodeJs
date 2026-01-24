import { GET } from '@/common/config/httpMethod.config';
import { upbitApi } from './fetchers/upbit.fetcher';

export const getUpbitMarkets = async () => {
    return await upbitApi({
        uri: '/market/all',
        method: GET,
        reqData: { isDetails: false },
    });
};

export const getUpbitTicker = async (markets: string) => {
    return await upbitApi({
        uri: '/ticker',
        method: GET,
        reqData: { markets },
    });
};

export const getUpbitCandles = async (market: string, unit: number, count: number, to?: string) => {
    return await upbitApi({
        uri: `/candles/minutes/${unit}`,
        method: GET,
        reqData: {
            market,
            count,
            to,
        },
    });
};
