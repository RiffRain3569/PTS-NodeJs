import { HOST, PORT } from '@/global/config/info';
import { send } from '@/global/config/telegram';
import axios from 'axios';
import cron from 'node-cron';

type Types = {
    hour: number;
    second?: number;
    duringHour?: number;
    top: number;
    askPercent: number;
};
export const hold_hour = ({ hour, second = 0, duringHour = 2, top, askPercent }: Types) => {
    let market: any;
    let uuids: string[] = [];

    // 한 종목 매수
    cron.schedule(`${second} 1 ${hour} * * *`, async () => {
        try {
            market = (await axios.post(`${HOST}:${PORT}/bithumb/order/bid/top/${top}`)).data;
            console.log(`${market.korean_name} 매수 완료 했습니다.`);
            await send(`${market.korean_name} 매수 완료 했습니다.`);
        } catch (error) {
            await send('에러가 발생하였습니다.');
            console.log(error);
        }
    });

    // 목표 매도 걸기
    cron.schedule(`${second + 2} 1 ${hour} * * *`, async () => {
        try {
            // const testMarkets = [ { market: 'KRW-KAITO', trade_price: 2772 } ];
            if (!!market?.market) {
                uuids = (
                    await axios.post(`${HOST}:${PORT}/bithumb/order/ask/limit`, {
                        markets: [market],
                        percent: askPercent,
                    })
                ).data;
                console.log(`${uuids.join(', ')} 매도 예약 완료 했습니다.`);
                await send(`${uuids.join(', ')} 매도 예약 완료 했습니다.`);
            }
        } catch (error) {
            await send('에러가 발생하였습니다.');
            console.log(error);
        }
    });

    // 지정 시간 후 예약된 매도 취소 후 전량 매도
    cron.schedule(`${second} 1 ${(hour + duringHour) % 24} * * *`, async () => {
        try {
            const waitingMarket = (await axios.delete(`${HOST}:${PORT}/bithumb/order`)).data;
            console.log(waitingMarket.map(({ market }: any) => market));

            if (waitingMarket.length !== 0) {
                await axios.post(`${HOST}:${PORT}/bithumb/order/ask`, {
                    markets: waitingMarket.map(({ market }: any) => market),
                });
                console.log(`${waitingMarket.map(({ market }: any) => market).join(', ')} 매도 완료 했습니다.`);
                await send(`${waitingMarket.map(({ market }: any) => market).join(', ')} 매도 완료 했습니다.`);
            } else {
                console.log('매도할 종목이 없습니다.');
            }
        } catch (error) {
            await send('에러가 발생하였습니다.');
            console.log(error);
        }
    });
};
