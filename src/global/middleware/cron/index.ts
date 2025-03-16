import { HOST, PORT } from '@/global/config/info';
import { send } from '@/global/config/telegram';
import axios from 'axios';
import cron from 'node-cron';
import { two_hour } from './strategy2';

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
            console.log(JSON.stringify(test.data, null, 4));
            await send(JSON.stringify(test.data, null, 4));
        });
    }
};

export const cronMiddleware = () => {
    if (process.env.NODE_ENV === 'production') {
        notiCron();
    } else {
        two_hour({ hour: 1, top: 2, askPercent: 0.01 });
        two_hour({ hour: 3, second: 2, top: 1, askPercent: 0.02 });
        two_hour({ hour: 5, second: 4, top: 1, askPercent: 0.01 });
        two_hour({ hour: 10, top: 4, askPercent: 0.01 });
        two_hour({ hour: 12, second: 2, top: 5, askPercent: 0.01 });
        two_hour({ hour: 21, top: 5, askPercent: 0.02 });
    }
};
