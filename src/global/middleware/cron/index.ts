import { HOST, PORT } from '@/global/config/info';
import { send } from '@/global/config/telegram';
import axios from 'axios';
import cron from 'node-cron';
import { hold_hour } from './holdHour';

/**
 * 1시 - 21시 사이 1시간 마다 변동률 상위 5개 조회
 */
export const notiCron = () => {
    const ignoreHours = [0, 7, 8, 9, 22, 23];
    const hours = Array.from({ length: 24 }, (_, i) => i).filter((hour) => !ignoreHours.includes(hour));
    for (const hour of hours) {
        // 변동률 상위 5개 조회
        cron.schedule(`1 ${hour} * * *`, async () => {
            try {
                const markets = await axios.get(`${HOST}:${PORT}/bithumb/market/top5`);
                await send(JSON.stringify(markets.data, null, 4));
            } catch (error) {
                console.log(error);
            }
        });
    }
};

export const logCron = () => {
    const ignoreHours = [0, 7, 8, 9, 22, 23];
    const hours = Array.from({ length: 24 }, (_, i) => i).filter((hour) => !ignoreHours.includes(hour));
    for (const hour of hours) {
        // 변동률 상위 5개 조회
        cron.schedule(`1 ${hour} * * *`, async () => {
            await axios.get(`${HOST}:${PORT}/bithumb/market/top5`);
        });
    }
};

export const cronMiddleware = () => {
    if (process.env.NODE_ENV === 'production') {
        notiCron();
        hold_hour({ hour: 1, second: 2, top: 3, askPercent: 0.05 });
        hold_hour({ hour: 3, second: 4, top: 1, askPercent: 0.02 });
        hold_hour({ hour: 5, second: 6, top: 1, askPercent: 0.05 });
        hold_hour({ hour: 10, second: 2, top: 4, askPercent: 0.01 });
        hold_hour({ hour: 12, second: 4, top: 5, askPercent: 0.01 });

        hold_hour({ hour: 16, second: 2, duringHour: 1, top: 5, askPercent: 0.02 });
        hold_hour({ hour: 17, second: 4, duringHour: 1, top: 5, askPercent: 0.02 });
        hold_hour({ hour: 18, second: 6, duringHour: 1, top: 5, askPercent: 0.05 });
        hold_hour({ hour: 19, second: 8, duringHour: 1, top: 3, askPercent: 0.03 });
        hold_hour({ hour: 20, second: 10, duringHour: 1, top: 3, askPercent: 0.05 });
        hold_hour({ hour: 21, second: 12, top: 5, askPercent: 0.02 });
    } else {
        logCron();
        // hold_hour({ hour: 1, second: 1, top: 3, askPercent: 0.05 });
        // hold_hour({ hour: 3, second: 2, top: 1, askPercent: 0.02 });
        // hold_hour({ hour: 5, second: 3, top: 1, askPercent: 0.05 });
        // hold_hour({ hour: 10, second: 1, top: 4, askPercent: 0.01 });
        // hold_hour({ hour: 12, second: 2, top: 5, askPercent: 0.01 });

        // hold_hour({ hour: 16, second: 1, duringHour: 1, top: 5, askPercent: 0.02 });
        // hold_hour({ hour: 17, second: 2, duringHour: 1, top: 5, askPercent: 0.02 });
        // hold_hour({ hour: 18, second: 2, duringHour: 1, top: 5, askPercent: 0.05 });
        // hold_hour({ hour: 19, second: 4, duringHour: 1, top: 5, askPercent: 0.03 });
        // hold_hour({ hour: 20, second: 3, duringHour: 1, top: 5, askPercent: 0.05 });
        // hold_hour({ hour: 21, second: 6, top: 5, askPercent: 0.02 });
    }
};
