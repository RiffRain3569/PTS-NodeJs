import { GET, POST } from '@/common/config/httpMethod.config';
import { bitgetApi } from './fetchers/bitget.fetcher';

type GetTickerTypes = {
    symbol: string;
    productType: string;
};

export const getTicker = async ({ ...rest }: GetTickerTypes) => {
    return await bitgetApi({
        uri: `/api/v2/mix/market/ticker`,
        method: GET,
        reqData: rest,
    });
};

export const getSpotTickers = async () => {
    return await bitgetApi({
        uri: `/api/v2/spot/market/tickers`,
        method: GET,
        reqData: {},
    });
};

type GetAccountTypes = {
    symbol: string;
    productType: string;
    marginCoin: string;
};

export const getAccount = async ({ ...rest }: GetAccountTypes) => {
    return await bitgetApi({
        uri: `/api/v2/mix/account/account`,
        method: GET,
        reqData: rest,
    });
};

type PostLeverageTypes = {
    symbol: string;
    productType: string;
    marginCoin: string;
    leverage: string;
    holdSide?: 'long' | 'short';
};

export const postLeverage = async ({ ...rest }: PostLeverageTypes) => {
    return await bitgetApi({
        uri: `/api/v2/mix/account/set-leverage`,
        method: POST,
        reqData: { marginMode: 'cross', ...rest },
    });
};

type GetAllPositionTypes = {
    productType: string;
    marginCoin: string;
};

export const getAllPosition = async ({ ...rest }: GetAllPositionTypes) => {
    return await bitgetApi({
        uri: `/api/v2/mix/position/all-position`,
        method: GET,
        reqData: rest,
    });
};

type PostOrderTypes = {
    symbol: string;
    productType: string;
    marginMode?: 'crossed' | 'isolated';
    marginCoin: string;
    size: string;
    price?: string; // Required if the "orderType" is limit
    side: 'buy' | 'sell';
    tradeSide?: 'open' | 'close';
    orderType: 'limit' | 'market';
    force?: 'ioc' | 'fok' | 'gtc' | 'post_only'; // Required if the "orderType" is limit
    clientOid?: string;
    presetStopLossPrice?: string;
};

export const postOrder = async ({ ...rest }: PostOrderTypes) => {
    return await bitgetApi({
        uri: `/api/v2/mix/order/place-order`,
        method: POST,
        reqData: { marginMode: 'cross', ...rest },
    });
};

type PostFlashClosePositionTypes = {
    symbol: string;
    holdSide?: 'long' | 'short';
    productType: string;
};

export const postFlashClosePosition = async ({ ...rest }: PostFlashClosePositionTypes) => {
    return await bitgetApi({
        uri: `/api/v2/mix/order/close-positions`,
        method: POST,
        reqData: { ...rest },
    });
};
