import { decrypt, encrypt } from '@/common/utils/envCrypto.utils';
import dotenv from 'dotenv';

export const envMiddleware = () => {
    dotenv.config();
    if (process.env.NODE_ENV === 'production') {
        dotenv.config({ path: '.env.production', override: true });
    } else if (process.env.NODE_ENV === 'development') {
        dotenv.config({ path: '.env.local', override: true });
    }

    Object.entries(process.env).forEach(([key, value]) => {
        const trimValue = (value ?? '').trim();
        if (trimValue.startsWith('ENC(') && trimValue.endsWith(')')) {
            process.env[key] = decrypt(trimValue.slice(4, -1));
        }
        // 암호화 하고 싶은 env 값. 변환 후 env 값에 복붙
        if (trimValue.startsWith('ENCTEST:')) {
            console.log(`${key}: ENC(${encrypt(trimValue.slice(8))})`);
        }
        // 복호화 하고 싶은 env 값을 확인하는 부분 (테스팅)
        if (trimValue.startsWith('DECTEST:')) {
            console.log(`${key}: `, decrypt(trimValue.slice(12, -1)));
        }
    });
};
