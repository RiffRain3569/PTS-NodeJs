import { DELETE, GET, POST } from '@/common/config/httpMethod.config';
import { bithumbPrivateApi, bithumbPublicApi } from './fetchers/bithumb.fetcher';

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Public
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const getMarket = async ({ markets }: { markets?: string }) => {
    return await bithumbPublicApi({
        uri: `/v1/market/all`,
        method: GET,
        reqData: { markets },
    });
};

export const getTicker = async ({ markets }: { markets: string }) => {
    return await bithumbPublicApi({
        uri: `/v1/ticker`,
        method: GET,
        reqData: { markets },
    });
};

export const getCandleMinute = async ({ market, to, count }: { market: string; to: string; count: number }) => {
    return await bithumbPublicApi({
        uri: `/v1/candles/minutes/1`,
        method: GET,
        reqData: { market, to, count },
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Private
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const getAccount = async ({ apiKey, secret }: { apiKey: string; secret: string }) => {
    return await bithumbPrivateApi({
        uri: `/v1/accounts`,
        method: GET,
        apiKey,
        secret,
    });
};

export const getOrder = async ({ market, apiKey, secret }: { apiKey: string; secret: string; market: string }) => {
    return await bithumbPrivateApi({
        uri: `/v1/orders/chance`,
        method: GET,
        reqData: { market },
        apiKey,
        secret,
    });
};

type OrderTypes = {
    market: string;
    side: 'bid' | 'ask'; // 매수, 매도
    volume?: string; // 지장가, 시장가 매도 시 필수
    price?: string; // 지정가, 시장가 매수 시 필수
    ord_type: 'limit' | 'price' | 'market'; // 지정가, 시장가(매수), 시장가(매도)
    apiKey: string;
    secret: string;
};

export const postOrder = async ({ apiKey, secret, ...rest }: OrderTypes) => {
    return await bithumbPrivateApi({
        uri: `/v1/orders`,
        method: POST,
        reqData: { ...rest },
        apiKey,
        secret,
    });
};

export const getOrderBook = async ({
    apiKey,
    secret,
    markets,
}: {
    apiKey: string;
    secret: string;
    markets: string[];
}) => {
    return await bithumbPrivateApi({
        uri: `/v1/orderbook`,
        method: GET,
        reqData: { markets: markets.join(',') },
        apiKey,
        secret,
    });
};

type OrderListTypes = {
    market?: string;
    uuids?: string[];
    state?: 'wait' | 'watch' | 'done' | 'cancel';
    states?: ('wait' | 'watch' | 'done' | 'cancel')[];
    page?: number;
    limit?: number;
    order_by?: 'asc' | 'desc';
    apiKey: string;
    secret: string;
};

export const getOrderList = async ({
    apiKey,
    secret,
    // state = 'wait',
    // page = 1,
    // limit = 100,
    // order_by = 'desc',
    ...rest
}: OrderListTypes) => {
    return await bithumbPrivateApi({
        uri: `/v1/orders`,
        method: GET,
        reqData: { ...rest },
        apiKey,
        secret,
    });
};

type DeleteOrderTypes = {
    uuid: string;
    apiKey: string;
    secret: string;
};

export const deleteOrder = async ({ apiKey, secret, ...rest }: DeleteOrderTypes) => {
    return await bithumbPrivateApi({
        uri: `/v1/order`,
        method: DELETE,
        reqData: { ...rest },
        apiKey,
        secret,
    });
};
