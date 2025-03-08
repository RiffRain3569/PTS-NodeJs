import { HOST, PORT } from '@/global/config/info';
import { send } from '@/global/config/telegram';
import axios from 'axios';
import cron from 'node-cron';

/**
 * 3시 1분에 변동률 상위 첫 번째 매수
 * 10% 되면 매도
 * 매도 못한 코인은 5시 전량 매도
 */
export const strategy2 = () => {
    let market: any;
    let uuids: string[] = [];

    // 3시 1분 변동률 상위 첫 번째 매수
    cron.schedule('1 3 * * *', async () => {
        try {
            market = (await axios.post(`${HOST}:${PORT}/bithumb/order/bid/top/1`)).data;
            console.log(`${market.korean_name} 매수 완료 했습니다.`);
            send(`${market.korean_name} 매수 완료 했습니다.`);
        } catch (error) {
            send(JSON.stringify(error, null, 4));
        }
    });

    // 10% 매도 걸기
    cron.schedule('2 3 * * *', async () => {
        // const testMarkets = [
        //     { market: 'KRW-KAITO', trade_price: 2772 },
        //     { market: 'KRW-IP', trade_price: 9380 },
        //     { market: 'KRW-STPT', trade_price: 169 },
        //     { market: 'KRW-TIA', trade_price: 5620 },
        //     { market: 'KRW-LPT', trade_price: 10390 },
        // ];
        uuids = (await axios.post(`${HOST}:${PORT}/bithumb/order/ask/limit`, { markets: [market], percent: 0.1 })).data;
        console.log(`${uuids.join(', ')} 매도 예약 완료 했습니다.`);
        send(`${uuids.join(', ')} 매도 예약 완료 했습니다.`);
    });

    // 5시 1분에 예약된 매도 취소 후 전량 매도
    cron.schedule('1 5 * * *', async () => {
        const waitingMarket = (await axios.delete(`${HOST}:${PORT}/bithumb/order`)).data;
        console.log(waitingMarket.map(({ market }: any) => market));

        await axios.post(`${HOST}:${PORT}/bithumb/order/ask`, {
            markets: waitingMarket.map(({ market }: any) => market),
        });
        console.log(`${waitingMarket.map(({ market }: any) => market).join(', ')} 매도 완료 했습니다.`);
        send(`${waitingMarket.map(({ market }: any) => market).join(', ')} 매도 완료 했습니다.`);
    });
};
