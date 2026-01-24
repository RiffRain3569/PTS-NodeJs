import { API_KEY, SECRET_KEY } from '@/common/config/upbit.config';
import axios from 'axios';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { parse, stringify } from 'qs';
import { v4 as uuidv4 } from 'uuid';

type Types = {
    uri: string;
    method: string;
    reqData?: any;
    options?: any;
    contentType?: string;
};

export const upbitApi = async ({
    uri,
    method,
    reqData,
    options = {},
    contentType = 'application/json; charset=UTF-8',
}: Types) => {
    const isGet = method.toUpperCase() === 'GET';

    const queryStr = isGet && reqData ? `?${stringify(reqData, { encode: true })}` : '';

    console.log('🔍 reqData:', reqData);

    const payload: any = {
        access_key: API_KEY,
        nonce: uuidv4(),
    };

    if (reqData && Object.keys(reqData).length > 0) {
        if (isGet) {
            const hash = crypto.createHash('sha512');
            const queryHash = hash.update(stringify(reqData, { encode: true }), 'utf-8').digest('hex');
            payload.query_hash = queryHash;
            payload.query_hash_alg = 'SHA512';
        }
    }

    const token = jwt.sign(payload, SECRET_KEY);

    return await axios({
        ...options,
        baseURL: 'https://api.upbit.com/v1',
        url: `${uri}${queryStr}`,
        method: method,
        headers: {
            Accept: 'application/json',
            'Content-Type': contentType,
            Authorization: `Bearer ${token}`,
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
