import { DELETE, GET, POST } from '@/common/config/httpMethod.config';
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

export const getUpbitAccount = async () => {
    return await upbitApi({
        uri: '/accounts',
        method: GET,
    });
};

export const getUpbitOrderChance = async ({ market }: { market: string }) => {
    return await upbitApi({
        uri: '/orders/chance',
        method: GET,
        reqData: { market },
    });
};

export const getUpbitOrderList = async ({
    market,
    state,
    states,
}: { market?: string; state?: string; states?: string[] } = {}) => {
    return await upbitApi({
        uri: '/orders',
        method: GET,
        reqData: { market, state, states },
    });
};

export const postUpbitOrder = async ({
    market,
    side,
    volume,
    price,
    ord_type,
}: {
    market: string;
    side: 'bid' | 'ask';
    volume: string;
    price: string;
    ord_type: 'limit' | 'price' | 'market';
}) => {
    return await upbitApi({
        uri: '/orders',
        method: POST,
        reqData: { market, side, volume, price, ord_type },
    });
};

export const deleteUpbitOrder = async ({ uuid }: { uuid: string }) => {
    return await upbitApi({
        uri: '/order',
        method: DELETE,
        reqData: { uuid },
    });
};
