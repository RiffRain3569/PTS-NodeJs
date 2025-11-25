import { HOST, PORT } from '@/global/config/info.config';
import { send } from '@/global/config/telegram.config';
import axios from 'axios';
import cron from 'node-cron';

type Types = {
    hour: number;
    second?: number;
    duringHour?: number;
    top: number;
    askPercent: number;
    position?: 'LONG' | 'SHORT';
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
            await send(`bithumb ${market} 매수 에러가 발생하였습니다.`);
            console.log(error);
        }
    });

    // 목표 매도 걸기
    cron.schedule(`${second + 5} 1 ${hour} * * *`, async () => {
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
            await send(`bithumb ${market} 지정가 에러가 발생하였습니다.`);
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
            await send(`bithumb ${market} 매도 에러가 발생하였습니다.`);
            console.log(error);
        }
    });
};

export const hold_hour_bitget = ({ hour, second = 0, duringHour = 2, top, position = 'SHORT' }: Types) => {
    let market: any;

    // 한 종목 매수
    cron.schedule(`${second} 1 ${hour} * * *`, async () => {
        try {
            const markets: any[] = (await axios.get(`${HOST}:${PORT}/bithumb/market/top5`)).data;
            const targetMarket = markets.at(Number(top) - 1) ?? { market: '' };
            market = targetMarket.market.replace('KRW-', '') + 'USDT'; // KRW-BTC -> BTCUSDT

            await axios.post(`${HOST}:${PORT}/bitget/${market}`, { message: position });
            await send(`bitget ${market} ${position} 포지션 오픈 완료 했습니다.`);
        } catch (error) {
            await send(`bitget ${market} 매수 에러가 발생하였습니다.`);
            console.log(error);
        }
    });

    // 지정 시간 후 예약된 매도 취소 후 전량 매도
    cron.schedule(`${second} 1 ${(hour + duringHour) % 24} * * *`, async () => {
        try {
            await axios.post(`${HOST}:${PORT}/bitget/${market}`, { message: 'S TP' });
            await send(`bitget ${market} 포지션 클로즈 완료 했습니다.`);
        } catch (error) {
            await send(`bitget ${market} 매도 에러가 발생하였습니다.`);
            console.log(error);
        }
    });
};
