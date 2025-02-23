import { HOST, PORT } from '@/config/info';
import cron from 'node-cron';

export const testCron = () => {
    // 6시 1분 변동률 상위 5개 매수
    cron.schedule('* * * * *', () => {
        const host = process.env.HOST;
        const port = process.env.PORT;
        console.log(`${host}:${port}/bithumb/market/top5`);
        fetch(`${host}:${port}/bithumb/market/top5`);
    });
};

/**
 * 6시 1분에 변동률 상위 5개를 매수
 * 15% 되면 매도
 * 매도 못한 코인은 8시 전량 매도
 */
export const tradingStrategy1 = () => {
    let markets = [];

    // 6시 1분 변동률 상위 5개 매수
    cron.schedule('1 6 * * *', () => {
        fetch(`${HOST}:${PORT}/market/top5`);
    });

    // 15% 매도 걸기
    cron.schedule('2 6 * * *', () => {
        fetch(`${HOST}:${PORT}/market/ask`);
    });

    // 8시 1분에 예약된 매도 취소 후 전량 매도
    cron.schedule('1 8 * * *', () => {
        fetch(`${HOST}:${PORT}/market/ask/all`);
    });
};
