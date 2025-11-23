import { API_KEY, PASSPHRASE, SECRET_KEY } from '@/global/config/bitget.config';
import axios from 'axios';
import crypto from 'crypto';
import { parse, stringify } from 'qs';

type Types = {
    uri: string;
    method: string;
    reqData?: any;
    options?: any;
    contentType?: string;
};
export const bitgetApi = async ({
    uri,
    method,
    reqData,
    options = {},
    contentType = 'application/json; charset=UTF-8',
}: Types) => {
    const isGet = method.toUpperCase() === 'GET';
    const timestamp = Date.now().toString();

    const queryStr = isGet && reqData ? `?${stringify(reqData, { encode: true })}` : '';
    const bodyStr = !isGet && reqData ? JSON.stringify(reqData) : '';

    const payload = `${timestamp}${method.toUpperCase()}${uri}${queryStr}${bodyStr}`;
    const signature = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('base64');

    console.log('🔍 reqData:', reqData);

    return await axios({
        ...options,
        baseURL: 'https://api.bitget.com',
        url: `${uri}${queryStr}`,
        method: method,
        headers: {
            Accept: 'application/json',
            'Content-Type': contentType,
            'ACCESS-KEY': API_KEY,
            'ACCESS-SIGN': signature,
            'ACCESS-TIMESTAMP': timestamp,
            'ACCESS-PASSPHRASE': PASSPHRASE,
            locale: 'en-US',
        },

        data: isGet ? undefined : reqData,
        paramsSerializer: {
            encode: parse,
            serialize: (params) => stringify(params, { arrayFormat: 'repeat' }),
        },
    })
        .then((response) => {
            return response.data;
        })
        .catch((error) => {
            console.log('error', error?.response?.data);
            throw !!error?.code // http 에러 코드
                ? { error: error.code, message: error.message }
                : {
                      error: 'CONNECT_ERROR',
                      message: '통신이 원활하지 않습니다.',
                  };
        });
};
