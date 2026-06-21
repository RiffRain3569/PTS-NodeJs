import { getCandle, getCandlesRecent, getContracts, getFuturesTickers } from '@/common/apis/bitget.api';
import { getCandleMinute, getMarket, getTicker } from '@/common/apis/bithumb.api';
import { getUpbitCandles, getUpbitMarkets, getUpbitTicker } from '@/common/apis/upbit.api';
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
            }, {}),
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

    async getUpbitTop5Markets() {
        // 1. Get all KRW markets
        const allMarkets = await getUpbitMarkets();
        const krwMarkets = allMarkets.filter((m: any) => m.market.startsWith('KRW-'));

        // 2. Get tickers for all KRW markets (Upbit allows multiple markets in one call)
        // Upbit URL length limit usually allows many markets, but splitting is safer if too many.
        // Assuming ~100-200 markets, likely fine. Otherwise split into chunks.
        // Let's split into chunks of 100 just in case.
        const chunkSize = 100;
        let allTickers: any[] = [];

        for (let i = 0; i < krwMarkets.length; i += chunkSize) {
            const chunk = krwMarkets.slice(i, i + chunkSize);
            const marketStr = chunk.map((m: any) => m.market).join(',');
            const tickers = await getUpbitTicker(marketStr);
            allTickers = [...allTickers, ...tickers];
        }

        // 3. Sort by Trade Price (Volume) or Change Rate?
        // Bithumb logic uses 'signed_change_rate' desc?
        // Bithumb Code: sortedList = mergedList.sort((a, b) => b.signed_change_rate - a.signed_change_rate);
        // User asked for "same logic as Bithumb". So I will sort by Change Rate Descending.

        const sortedList = allTickers.sort((a: any, b: any) => b.signed_change_rate - a.signed_change_rate);
        const ignoreMarkets = ['KRW-BTT']; // BTT is usually too small, Upbit might have similar.

        return sortedList
            .filter((t: any) => !ignoreMarkets.includes(t.market))
            .slice(0, 5)
            .map((t: any) => ({
                market: t.market,
                // korean_name is in market info, not ticker. Need to merge.
                korean_name: krwMarkets.find((m: any) => m.market === t.market)?.korean_name || t.market,
                trade_price: t.trade_price,
                change_rate: `${(t.signed_change_rate * 100).toFixed(2)}%`,
            }));
    }

    async getBitgetTop5Markets() {
        return this.getBitgetTopMarkets(5);
    }

    async scanMaAlignment(position: 'LONG' | 'SHORT' = 'LONG', minVolume: number = 5_000_000) {
        const result = await this.scanMaAlignmentAll(minVolume);
        return result.filter((d: any) => d.position === position).sort((a: any, b: any) => b.strength - a.strength);
    }

    async scanMaAlignmentAll(minVolume: number = 5_000_000, granularity: string = '1m', maxLever: number = 0) {
        // 1. Get all USDT futures tickers
        const tickersRes = await getFuturesTickers();
        if (tickersRes.code !== '00000') {
            throw new Error(tickersRes.msg || 'Bitget API Error');
        }

        const allTickers: any[] = tickersRes.data.filter((m: any) => m.symbol.endsWith('USDT'));

        // 2. Filter by max leverage (contract info)
        let leverFilterSet: Set<string> | null = null;
        if (maxLever > 0) {
            const contractsRes = await getContracts({ productType: 'USDT-FUTURES' });
            if (contractsRes.code === '00000') {
                leverFilterSet = new Set(
                    contractsRes.data
                        .filter((c: any) => Number(c.maxLever) <= maxLever)
                        .map((c: any) => c.symbol),
                );
            }
        }

        // 3. Filter by minimum 24h USDT volume + leverage
        const filtered = allTickers
            .filter((m: any) => parseFloat(m.usdtVolume) >= minVolume)
            .filter((m: any) => !leverFilterSet || leverFilterSet.has(m.symbol))
            .sort((a: any, b: any) => parseFloat(b.usdtVolume) - parseFloat(a.usdtVolume));

        // 3. Fetch 1m candles (200개: MA120 계산 + 최대 80분 역추적 가능)
        const concurrency = 10;
        const aligned: any[] = [];

        for (let i = 0; i < filtered.length; i += concurrency) {
            const chunk = filtered.slice(i, i + concurrency);
            const chunkResults = await Promise.all(
                chunk.map(async (m: any) => {
                    try {
                        const res = await getCandlesRecent({ symbol: m.symbol, granularity, limit: 200 });
                        if (!res || res.code !== '00000' || !res.data?.length) return null;

                        // Bitget returns candles oldest-first
                        const closes: number[] = res.data
                            .map((c: any[]) => parseFloat(c[4]));

                        if (closes.length < 120) return null;

                        // Compute MA at the latest position
                        const maAt = (pos: number, period: number) => {
                            const start = pos - period + 1;
                            if (start < 0) return NaN;
                            let sum = 0;
                            for (let j = start; j <= pos; j++) sum += closes[j];
                            return sum / period;
                        };

                        const lastIdx = closes.length - 1;
                        const ma30 = maAt(lastIdx, 30);
                        const ma60 = maAt(lastIdx, 60);
                        const ma90 = maAt(lastIdx, 90);
                        const ma120 = maAt(lastIdx, 120);
                        const currentPrice = closes[lastIdx];

                        const isLongAligned = ma30 > ma60 && ma60 > ma90 && ma90 > ma120;
                        const isShortAligned = ma30 < ma60 && ma60 < ma90 && ma90 < ma120;

                        if (!isLongAligned && !isShortAligned) return null;

                        const position = isLongAligned ? 'LONG' : 'SHORT';

                        // 4. Duration: 역추적 - 조건이 깨지는 지점 찾기
                        let duration = 0;
                        for (let k = 1; k <= lastIdx - 119; k++) {
                            const pos = lastIdx - k;
                            const m30 = maAt(pos, 30);
                            const m60 = maAt(pos, 60);
                            const m90 = maAt(pos, 90);
                            const m120 = maAt(pos, 120);
                            if (isNaN(m120)) break;

                            const stillAligned =
                                position === 'LONG'
                                    ? m30 > m60 && m60 > m90 && m90 > m120
                                    : m30 < m60 && m60 < m90 && m90 < m120;

                            if (!stillAligned) {
                                duration = k;
                                break;
                            }
                        }
                        // If never broke within our data range
                        if (duration === 0) duration = lastIdx - 119;

                        const strength =
                            position === 'LONG'
                                ? ((ma30 - ma120) / ma120) * 100
                                : ((ma120 - ma30) / ma120) * 100;

                        // 캔들 수 → 분 환산
                        const candleMinutes: Record<string, number> = { '1m': 1, '5m': 5, '15m': 15 };
                        const minutesPerCandle = candleMinutes[granularity] || 1;

                        return {
                            symbol: m.symbol,
                            position,
                            current_price: currentPrice,
                            change_24h: (parseFloat(m.change24h) * 100).toFixed(2),
                            volume_24h_usdt: parseFloat(m.usdtVolume),
                            ma30: parseFloat(ma30.toFixed(6)),
                            ma60: parseFloat(ma60.toFixed(6)),
                            ma90: parseFloat(ma90.toFixed(6)),
                            ma120: parseFloat(ma120.toFixed(6)),
                            strength: parseFloat(strength.toFixed(4)),
                            duration_min: duration * minutesPerCandle,
                        };
                    } catch {
                        return null;
                    }
                }),
            );
            aligned.push(...chunkResults.filter(Boolean));
        }

        return aligned;
    }

    async getBitgetTopMarkets(topN: number = 5) {
        const response = await getFuturesTickers();
        if (response.code !== '00000') {
            throw new Error(response.msg || 'Bitget API Error');
        }

        const markets = response.data;
        const usdtMarkets = markets.filter((m: any) => m.symbol.endsWith('USDT'));

        const sortedList = usdtMarkets.sort((a: any, b: any) => {
            return parseFloat(b.change24h) - parseFloat(a.change24h);
        });

        return sortedList.slice(0, topN).map((m: any, index: number) => {
            return {
                rank: index + 1,
                market: m.symbol,
                trade_price: m.lastPr,
                change_rate: `${(parseFloat(m.change24h) * 100).toFixed(2)}%`,
                change_rate_raw: parseFloat(m.change24h) * 100,
                open_utc_time: m.openUtc0,
                volume_24h: m.usdtVolume,
            };
        });
    }

    async calculateTradeResult(
        exchange: 'bitget' | 'bithumb' | 'upbit',
        symbol: string,
        baseTime: Date,
        options: {
            holdingMinutes?: number;
            side?: 'LONG' | 'SHORT';
            runId?: number;
            priceBasis?: 'last' | 'mark';
        } = {},
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
        } else if (exchange === 'upbit') {
            marketType = 'SPOT_KRW';
            const diffMin = holdingMinutes + 10;
            // Upbit API 'to' is UTC ISO string or similar.
            // Docs say: to: 마지막 캔들 시각 (exclusive). 포맷 : yyyy-MM-dd'T'HH:mm:ss'Z' or yyyy-MM-dd HH:mm:ss
            // Upbit response is KST by default? No, usually UTC in API response but query 'to' can be varying.
            // Let's use UTC ISO string.
            // But verify: Upbit API generally returns UTC KST?
            // Upbit candles are returned in KST (candle_date_time_kst) and UTC (candle_date_time_utc).
            // Request 'to' is ideally UTC.
            // Upbit API: If user wants KST input
            const kstOffset = 9 * 60 * 60 * 1000;
            const exitTimeForString = new Date(exitTimeMp + 60 * 1000 + kstOffset);
            const toStr = exitTimeForString.toISOString().replace('T', ' ').slice(0, 19);

            // count limit is 200. if diffMin > 200, need loop?
            // holdingMinutes = 120 (default for Spot). So 200 is enough.
            const response = await getUpbitCandles(symbol, 1, Math.min(diffMin, 200), toStr);
            if (Array.isArray(response)) {
                candles = response;
            }
        } else {
            marketType = 'SPOT_KRW';
            const diffMin = holdingMinutes + 10;
            // Bithumb API expects KST for the 'to' parameter
            const kstOffset = 9 * 60 * 60 * 1000;
            const exitTimeForString = new Date(exitTimeMp + 60 * 1000 + kstOffset);
            const toStr = exitTimeForString.toISOString().replace('T', ' ').slice(0, 19);

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
            const entryTimeKst = new Date(entryTimeMp);
            const exitTimeKst = new Date(exitTimeMp);

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
                } else if (exchange === 'upbit') {
                    return {
                        time: new Date(c.candle_date_time_utc + 'Z').getTime(), // Upbit returns "2023-01-01T00:00:00" (UTC string)
                        high: c.high_price,
                        low: c.low_price,
                        close: c.trade_price,
                        open: c.opening_price,
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
            .filter((c) => c.time >= Math.floor(entryTimeMp / 60000) * 60000 && c.time <= exitTimeMp);

        parsedCandles.sort((a, b) => a.time - b.time);

        if (parsedCandles.length === 0) {
            console.warn(
                `[MarketService] No candles in range for ${symbol}. Entry: ${entryTimeMp}, Exit: ${exitTimeMp}, FirstCandle: ${
                    candles[0]?.[0] || candles[0]?.candle_date_time_utc
                }`,
            );
            // Convert to KST for storage
            const entryTimeKst = new Date(entryTimeMp);
            const exitTimeKst = new Date(exitTimeMp);

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
        const entryTimeKst = new Date(entryTimeMp);
        const exitTimeKst = new Date(exitTimeMp);

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

    async recordOpenTrade(
        exchange: 'bitget' | 'bithumb' | 'upbit',
        symbol: string,
        entryTime: Date,
        holdingMinutes: number,
        entryPrice: string,
        side: 'LONG' | 'SHORT' = 'LONG',
        runId?: number,
    ): Promise<void> {
        // Convert to KST for consistency with storage
        const entryTimeKst = entryTime;
        // Note: Exit time logic is usually E + Holding.
        // We set exit_time in DB so we can query "when should I close this?"
        // But repository.findPendingTrades compares `DATE_ADD(entry_time, holding) <= now`.
        // If we store KST entry_time, then we must query using KST now?
        // Wait, if `entry_time` is stored as 01:00 KST (which is effectively just a string/datetime in DB).
        // And we run job at 03:00 KST.
        // `DATE_ADD('01:00', 120min)` = '03:00'.
        // So we should pass KST time to `findPendingTrades` or rely on DB server time?
        // Since we are moving away from DB time dependency, let's keep it clean.
        // If we store KST, we should query with KST-adjusted 'now'.
        // Or simply: store everything in UTC in DB and convert only for display?
        // But user explicitly added KST conversion code in Service.
        // I will follow the KST storage pattern.

        const exitTimeKst = new Date(entryTimeKst.getTime() + holdingMinutes * 60 * 1000);

        await this.marketRepository.saveTradeResult({
            exchange,
            symbol,
            market_type: exchange === 'bitget' ? 'USDT_PERP' : 'SPOT_KRW',
            side,
            entry_time: entryTimeKst,
            holding_minutes: holdingMinutes,
            exit_time: exitTimeKst, // Pre-calculate expected exit time
            entry_price: entryPrice,
            exit_price: null,
            max_roi_pct: null,
            min_roi_pct: null,
            exit_roi_pct: null,
            max_price_during: null,
            min_price_during: null,
            price_basis: 'last',
            timezone: 'KST', // Explicitly marking KST
            status: 'WAITING',
            note: 'Open Trade',
            run_id: runId,
        });
    }
}
