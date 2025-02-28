import { HOST, PORT } from '@/global/config/info';
import { send } from '@/global/config/telegram';
import axios from 'axios';
import cron from 'node-cron';

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

/**
 * 6시 1분에 변동률 상위 5개를 매수
 * 15% 되면 매도
 * 매도 못한 코인은 8시 전량 매도
 */
export const tradingStrategy1 = () => {
    let markets: any = [];
    let uuids: string[] = [];

    // 6시 1분 변동률 상위 5개 매수
    cron.schedule('1 6 * * *', async () => {
        try {
            markets = (await axios.post(`${HOST}:${PORT}/bithumb/order/bid/top5`)).data;
            console.log(`${markets.map(({ korean_name }: any) => korean_name).join(', ')} 매수 완료 했습니다.`);
            send(`${markets.map(({ korean_name }: any) => korean_name).join(', ')} 매수 완료 했습니다.`);
        } catch (error) {
            send(JSON.stringify(error, null, 4));
        }
    });

    // 15% 매도 걸기
    cron.schedule('2 6 * * *', async () => {
        // const testMarkets = [
        //     { market: 'KRW-KAITO', trade_price: 2772 },
        //     { market: 'KRW-IP', trade_price: 9380 },
        //     { market: 'KRW-STPT', trade_price: 169 },
        //     { market: 'KRW-TIA', trade_price: 5620 },
        //     { market: 'KRW-LPT', trade_price: 10390 },
        // ];
        uuids = (await axios.post(`${HOST}:${PORT}/bithumb/order/ask/limit`, { markets })).data;
        console.log(`${uuids.join(', ')} 매도 예약 완료 했습니다.`);
        send(`${uuids.join(', ')} 매도 예약 완료 했습니다.`);
    });

    // 8시 1분에 예약된 매도 취소 후 전량 매도
    cron.schedule('1 8 * * *', async () => {
        const waitingMarket = (await axios.delete(`${HOST}:${PORT}/bithumb/order`)).data;
        console.log(waitingMarket.map(({ market }: any) => market));

        await axios.post(`${HOST}:${PORT}/bithumb/order/ask`, {
            markets: waitingMarket.map(({ market }: any) => market),
        });
        console.log(`${waitingMarket.map(({ market }: any) => market).join(', ')} 매도 완료 했습니다.`);
        send(`${waitingMarket.map(({ market }: any) => market).join(', ')} 매도 완료 했습니다.`);
    });
};

export const cronMiddleware = () => {
    notiCron();
    // tradingStrategy1();
};
