import { HOST, PORT } from '@/global/config/info';
import { send } from '@/global/config/telegram';
import axios from 'axios';
import cron from 'node-cron';

type Types = {
    hour: number;
    second?: number;
    top: number;
    askPercent: number;
};
export const two_hour = ({ hour, second = 0, top, askPercent }: Types) => {
    let market: any;
    let uuids: string[] = [];

    // 한 종목 매수
    cron.schedule(`${second} 1 ${hour} * * *`, async () => {
        try {
            market = (await axios.post(`${HOST}:${PORT}/bithumb/order/bid/top/${top}`)).data;
            console.log(`${market.korean_name} 매수 완료 했습니다.`);
            await send(`${market.korean_name} 매수 완료 했습니다.`);
        } catch (error) {
            await send(JSON.stringify(error, null, 4));
        }
    });

    // 목표 매도 걸기
    cron.schedule(`${second + 2} 1 ${hour} * * *`, async () => {
        // const testMarkets = [ { market: 'KRW-KAITO', trade_price: 2772 } ];
        uuids = (
            await axios.post(`${HOST}:${PORT}/bithumb/order/ask/limit`, { markets: [market], percent: askPercent })
        ).data;
        console.log(`${uuids.join(', ')} 매도 예약 완료 했습니다.`);
        await send(`${uuids.join(', ')} 매도 예약 완료 했습니다.`);
    });

    // 2시간 후 예약된 매도 취소 후 전량 매도
    cron.schedule(`${second} 1 ${(hour + 2) % 24} * * *`, async () => {
        const waitingMarket = (await axios.delete(`${HOST}:${PORT}/bithumb/order`)).data;
        console.log(waitingMarket.map(({ market }: any) => market));

        await axios.post(`${HOST}:${PORT}/bithumb/order/ask`, {
            markets: waitingMarket.map(({ market }: any) => market),
        });
        console.log(`${waitingMarket.map(({ market }: any) => market).join(', ')} 매도 완료 했습니다.`);
        await send(`${waitingMarket.map(({ market }: any) => market).join(', ')} 매도 완료 했습니다.`);
    });
};
