import { getCandle, getSpotTickers } from '@/common/apis/bitget.api';
import { getCandleMinute, getMarket, getTicker } from '@/common/apis/bithumb.api';
import { Injectable } from '@nestjs/common';
import { MarketRepository } from './infrastructure/market.repository';

@Injectable()
export class MarketService {
    constructor(private readonly marketRepository: MarketRepository) {}

    async getTop5Markets() {
        const markets = (await getMarket({})).filter((el: any) => el.market.split('-').at(0) === 'KRW');
        const mid = Math.ceil(markets.length / 2);

        const tickers1 = await getTicker({
            markets: (markets.slice(0, mid) || []).map((coin: any) => coin.market).join(','),
        });
        const tickers2 = await getTicker({
            markets: (markets.slice(mid) || []).map((coin: any) => coin.market).join(','),
        });
        const ignoreMarkets = ['KRW-NFT', 'KRW-BTT', 'KRW-USDT', 'KRW-USDC'];

        const mergedList = Object.values(
            [...markets, ...tickers1, ...tickers2].reduce((acc: any, item: any) => {
                acc[item.market] = { ...acc[item.market], ...item };
                return acc;
            }, {})
        ).filter((el: any) => !ignoreMarkets.includes(el.market));

        const sortedList = mergedList.sort((a: any, b: any) => b.signed_change_rate - a.signed_change_rate);

        return sortedList
            .map(({ market, korean_name, trade_price, change_rate }: any) => ({
                market,
                korean_name,
                trade_price,
                change_rate: `${Math.floor(change_rate * 10000) / 100}%`,
            }))
            .splice(0, 5);
    }

    async getBitgetTop5Markets() {
        const response = await getSpotTickers();
        if (response.code !== '00000') {
            throw new Error(response.msg || 'Bitget API Error');
        }

        const markets = response.data;
        const usdtMarkets = markets.filter((m: any) => m.symbol.endsWith('USDT'));

        const sortedList = usdtMarkets.sort((a: any, b: any) => {
            return parseFloat(b.changeUtc24h) - parseFloat(a.changeUtc24h);
        });

        return sortedList.slice(0, 5).map((m: any) => {
            return {
                market: m.symbol,
                trade_price: m.lastPr,
                change_rate: `${(parseFloat(m.changeUtc24h) * 100).toFixed(2)}%`,
            };
        });
    }

    async calculateTradeResult(
        exchange: 'bitget' | 'bithumb',
        symbol: string,
        baseTime: Date,
        options: {
            holdingMinutes?: number;
            side?: 'LONG' | 'SHORT';
            runId?: number;
            priceBasis?: 'last' | 'mark';
        } = {}
    ): Promise<void> {
        const { runId, priceBasis = 'last' } = options;

        let holdingMinutes = options.holdingMinutes;
        let side = options.side;

        if (!holdingMinutes) {
            holdingMinutes = exchange === 'bitget' ? 60 : 120;
        }
        if (!side) {
            side = 'LONG';
        }

        const entryTimeMp = baseTime.getTime();
        const exitTimeMp = entryTimeMp + holdingMinutes * 60 * 1000;
        const exitTime = new Date(exitTimeMp);

        let candles: any[] = [];
        let marketType = '';

        if (exchange === 'bitget') {
            marketType = 'USDT_PERP';
            const response = await getCandle({
                symbol,
                granularity: '1m',
                startTime: entryTimeMp.toString(),
                endTime: exitTimeMp.toString(),
                productType: 'usdt-futures',
            });
            if (response.code === '00000') {
                candles = response.data;
            }
        } else {
            marketType = 'SPOT_KRW';
            const diffMin = holdingMinutes + 10;
            // Bithumb API expects KST for the 'to' parameter
            const kstOffset = 9 * 60 * 60 * 1000;
            const exitTimeKst = new Date(exitTimeMp + 60 * 1000 + kstOffset);
            const toStr = exitTimeKst.toISOString().replace('T', ' ').slice(0, 19);

            const response = await getCandleMinute({
                market: symbol,
                to: toStr,
                count: diffMin,
            });
            if (Array.isArray(response)) {
                candles = response;
            }
        }

        if (!candles || candles.length === 0) {
            // Convert to KST for storage
            const kstOffset = 9 * 60 * 60 * 1000;
            const entryTimeKst = new Date(entryTimeMp + kstOffset);
            const exitTimeKst = new Date(exitTimeMp + kstOffset);

            await this.marketRepository.saveTradeResult({
                exchange,
                symbol,
                market_type: marketType,
                side,
                entry_time: entryTimeKst,
                holding_minutes: holdingMinutes,
                exit_time: exitTimeKst,
                entry_price: '0',
                exit_price: '0',
                max_roi_pct: null,
                min_roi_pct: null,
                exit_roi_pct: null,
                max_price_during: null,
                min_price_during: null,
                price_basis: priceBasis,
                timezone: 'KST',
                status: 'MISSING_DATA',
                note: 'No candles found',
                run_id: runId,
            });
            return;
        }

        const parsedCandles = candles
            .map((c) => {
                if (exchange === 'bitget') {
                    return {
                        time: Number(c[0]),
                        high: parseFloat(c[2]),
                        low: parseFloat(c[3]),
                        close: parseFloat(c[4]),
                        open: parseFloat(c[1]),
                    };
                } else {
                    if (c.candle_date_time_utc) {
                        // Object format
                        return {
                            time: new Date(c.candle_date_time_utc + 'Z').getTime(),
                            high: Number(c.high_price),
                            low: Number(c.low_price),
                            close: Number(c.trade_price),
                            open: Number(c.opening_price),
                        };
                    } else {
                        // Array format
                        return {
                            time: Number(c[0]),
                            open: parseFloat(c[1]),
                            high: parseFloat(c[2]),
                            low: parseFloat(c[3]),
                            close: parseFloat(c[4]),
                        };
                    }
                }
            })
            .filter((c) => c.time >= entryTimeMp && c.time <= exitTimeMp);

        parsedCandles.sort((a, b) => a.time - b.time);

        if (parsedCandles.length === 0) {
            console.warn(
                `[MarketService] No candles in range for ${symbol}. Entry: ${entryTimeMp}, Exit: ${exitTimeMp}, FirstCandle: ${
                    candles[0]?.[0] || candles[0]?.candle_date_time_utc
                }`
            );
            // Convert to KST for storage
            const kstOffset = 9 * 60 * 60 * 1000;
            const entryTimeKst = new Date(entryTimeMp + kstOffset);
            const exitTimeKst = new Date(exitTimeMp + kstOffset);

            await this.marketRepository.saveTradeResult({
                exchange,
                symbol,
                market_type: marketType,
                side,
                entry_time: entryTimeKst,
                holding_minutes: holdingMinutes,
                exit_time: exitTimeKst,
                entry_price: '0',
                exit_price: '0',
                max_roi_pct: null,
                min_roi_pct: null,
                exit_roi_pct: null,
                max_price_during: null,
                min_price_during: null,
                price_basis: priceBasis,
                timezone: 'KST',
                status: 'MISSING_DATA',
                note: 'Filtered out (Time mismatch)',
                run_id: runId,
            });
            return;
        }

        const entryCandle = parsedCandles[0];
        const exitCandle = parsedCandles[parsedCandles.length - 1];

        const entryPrice = entryCandle.open;
        const exitPrice = exitCandle.close;

        let maxPrice = -Infinity;
        let minPrice = Infinity;

        parsedCandles.forEach((c) => {
            if (c.high > maxPrice) maxPrice = c.high;
            if (c.low < minPrice) minPrice = c.low;
        });

        let roi = 0;
        let maxRoi = 0;
        let minRoi = 0;

        if (side === 'LONG') {
            roi = ((exitPrice - entryPrice) / entryPrice) * 100;
            maxRoi = ((maxPrice - entryPrice) / entryPrice) * 100;
            minRoi = ((minPrice - entryPrice) / entryPrice) * 100;
        } else {
            roi = ((entryPrice - exitPrice) / entryPrice) * 100;
            maxRoi = ((entryPrice - minPrice) / entryPrice) * 100;
            minRoi = ((entryPrice - maxPrice) / entryPrice) * 100;
        }

        // Convert to KST for storage
        const kstOffset = 9 * 60 * 60 * 1000;
        const entryTimeKst = new Date(entryTimeMp + kstOffset);
        const exitTimeKst = new Date(exitTimeMp + kstOffset);

        await this.marketRepository.saveTradeResult({
            exchange,
            symbol,
            market_type: marketType,
            side,
            entry_time: entryTimeKst,
            holding_minutes: holdingMinutes,
            exit_time: exitTimeKst,
            entry_price: entryPrice.toFixed(10),
            exit_price: exitPrice.toFixed(10),
            max_roi_pct: maxRoi.toFixed(5),
            min_roi_pct: minRoi.toFixed(5),
            exit_roi_pct: roi.toFixed(5),
            max_price_during: maxPrice.toFixed(10),
            min_price_during: minPrice.toFixed(10),
            price_basis: priceBasis,
            timezone: 'KST',
            status: 'OK',
            run_id: runId,
        });
    }
}
