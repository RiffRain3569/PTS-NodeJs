import { HOST, PORT } from '@/global/config/info';
import { send } from '@/global/config/telegram';
import axios from 'axios';
import cron from 'node-cron';
import { strategy2 } from './strategy2';

/**
 * 1시 - 21시 사이 1시간 마다 변동률 상위 5개 조회
 */
export const notiCron = () => {
    const ignoreHours = [0, 7, 8, 9, 22, 23];
    const hours = Array.from({ length: 24 }, (_, i) => i).filter((hour) => !ignoreHours.includes(hour));
    for (const hour of hours) {
        // 변동률 상위 5개 조회
        cron.schedule(`1 ${hour} * * *`, async () => {
            const test = await axios.get(`${HOST}:${PORT}/bithumb/market/top5`);
            send(JSON.stringify(test.data, null, 4));
            const copy = test.data
                .map(({ korean_name, trade_price }: any) => `${korean_name}\n${trade_price}`)
                .join(`\n----\n`);
            send(copy);
        });
    }
};

export const cronMiddleware = () => {
    if (process.env.NODE_ENV === 'production') {
        notiCron();
    } else {
        strategy2();
    }
};
