import {
    getAccount,
    getAllPosition,
    getTicker,
    postFlashClosePosition,
    postLeverage,
    postOrder,
} from '@/global/apis/bitget.api';
import { asyncHandler } from '@/global/utils/asyncHandler.utils';
import { unitFloor } from '@/global/utils/bitget.utils';
import { Router } from 'express';

const router = Router();

type MsgType = 'SHORT' | 'LONG' | 'S TP' | 'L TP' | 'S SL' | 'L SL';
type SideType = 'buy' | 'sell';
router.post(
    '/:blockchainSymbol',
    asyncHandler(async (req: any, res: any) => {
        const { blockchainSymbol } = req.params;
        const { message }: { message: MsgType } = req.body;

        // 현재 포지션 정보 조회
        const allPosition = await getAllPosition({
            productType: 'USDT-FUTURES',
            marginCoin: 'USDT',
        });

        await postLeverage({
            symbol: blockchainSymbol,
            productType: 'USDT-FUTURES',
            marginCoin: 'USDT',
            leverage: '3',
        });

        // 익절, 손절 메시지 처리
        if (
            message === 'S TP' ||
            message === 'L TP' ||
            message === 'S SL' ||
            message === 'L SL' ||
            (message === 'SHORT' && allPosition?.data[0]?.holdSide === 'long') || // 롱 포지션이 있는 경우 반대 포지션 시그널
            (message === 'LONG' && allPosition?.data[0]?.holdSide === 'short') // 숏 포지션이 있는 경우 반대 포지션 시그널
        ) {
            await postFlashClosePosition({
                symbol: blockchainSymbol,
                productType: 'USDT-FUTURES',
            }).catch(() => {});
        }

        // SHORT, LONG 시그널 발생 시 포지션 오픈
        if (message === 'SHORT' || message === 'LONG') {
            const ticker = await getTicker({
                symbol: blockchainSymbol,
                productType: 'USDT-FUTURES',
            });

            const account = await getAccount({
                symbol: blockchainSymbol,
                productType: 'USDT-FUTURES',
                marginCoin: 'USDT',
            });

            const availableBalance = Math.floor(Number(account?.data?.crossedMaxAvailable)) - 2;
            const bidPrice = Number(ticker.data[0]?.bidPr);
            const askPrice = Number(ticker.data[0]?.askPr);
            const leverage = Number(account?.data?.crossedMarginLeverage);
            const lossPercent = 0.15;

            // 동일 포지션이면 추가 주문
            const side: SideType = message === 'SHORT' ? 'sell' : 'buy';
            const orderPrice = side === 'sell' ? askPrice : bidPrice;
            await postOrder({
                symbol: blockchainSymbol,
                productType: 'USDT-FUTURES',
                marginMode: 'crossed',
                marginCoin: 'USDT',
                size: `${Math.round(((availableBalance * leverage) / orderPrice) * 10000) / 10000}`,
                side: side,
                tradeSide: 'open',
                orderType: 'market',
                presetStopLossPrice: `${unitFloor(orderPrice * (1 + lossPercent))}`,
            });
        }

        res.json({ result: 'ok' });
    })
);

export default router;
