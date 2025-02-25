import { HOST, PORT } from '@/config/info';
import axios from 'axios';
import cron from 'node-cron';
import { send } from './config/telegram';

export const testCron = () => {
    // let test: any = [];
    // cron.schedule('35 24 * * * *', async () => {
    //     test = await axios.get(`${HOST}:${PORT}/bithumb/market/top5`);
    //     const copy = test.data
    //         .map(({ korean_name, trade_price }: any) => `${korean_name}\n${trade_price}`)
    //         .join(`\n----\n`);
    //     console.log('test: ', copy);
    // });
    // cron.schedule('58 * * * *', () => {
    //     console.log('test: ', test.data);
    // });
};

export const notiCron = () => {
    // 6시 1분 변동률 상위 5개 조회
    cron.schedule('1 6 * * *', async () => {
        const test = await axios.get(`${HOST}:${PORT}/bithumb/market/top5`);
        send(JSON.stringify(test.data, null, 4));
        const copy = test.data
            .map(({ korean_name, trade_price }: any) => `${korean_name}\n${trade_price}`)
            .join(`\n----\n`);
        send(copy);
    });

    // 13시 1분 변동률 상위 5개 조회
    cron.schedule('1 13 * * *', async () => {
        const test = await axios.get(`${HOST}:${PORT}/bithumb/market/top5`);
        send(JSON.stringify(test.data, null, 4));
        const copy = test.data
            .map(({ korean_name, trade_price }: any) => `${korean_name}\n${trade_price}`)
            .join(`\n----\n`);
        send(copy);
    });

    // 22시 1분 변동률 상위 5개 조회
    cron.schedule('1 22 * * *', async () => {
        const test = await axios.get(`${HOST}:${PORT}/bithumb/market/top5`);
        send(JSON.stringify(test.data, null, 4));
        const copy = test.data
            .map(({ korean_name, trade_price }: any) => `${korean_name}\n${trade_price}`)
            .join(`\n----\n`);
        send(copy);
    });
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
        markets = (await axios.post(`${HOST}:${PORT}/bithumb/order/bid/top5`)).data;
        console.log(markets);
        console.log(`${markets.map(({ korean_name }: any) => korean_name).join(', ')} 매수 완료 했습니다.`);
    });

    // 15% 매도 걸기
    cron.schedule('2 6 * * *', async () => {
        // const testMarkets = [
        //     { market: 'KRW-KAITO', trade_price: 2471 },
        //     { market: 'KRW-OBSR', trade_price: 3.709 },
        //     { market: 'KRW-TEMCO', trade_price: 2.707 },
        //     { market: 'KRW-APM', trade_price: 6.351 },
        // ];
        uuids = (await axios.post(`${HOST}:${PORT}/bithumb/order/ask/limit`, { markets })).data;
        console.log(`${uuids.join(', ')} 매도 예약 완료 했습니다.`);
    });

    // 8시 1분에 예약된 매도 취소 후 전량 매도
    cron.schedule('1 8 * * *', async () => {
        const waitingMarket = (await axios.delete(`${HOST}:${PORT}/bithumb/order`)).data;
        console.log(waitingMarket.map(({ market }: any) => market));

        await axios.post(`${HOST}:${PORT}/bithumb/order/ask`, {
            markets: waitingMarket.map(({ market }: any) => market),
        });
        console.log(`${waitingMarket.map(({ market }: any) => market).join(', ')} 매도 완료 했습니다.`);
    });
};
