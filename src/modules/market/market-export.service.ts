import { Injectable } from '@nestjs/common';
import { TradeResult } from './domain/trade-result.entity';
import { MarketRepository } from './infrastructure/market.repository';

export interface MarketExportParams {
    startDate: Date;
    endDate: Date;
    exchange: string;
    timezone: string;
    topN: number;
    dedupSymbol: boolean;
    sortBy: 'exit_roi_pct' | 'max_roi_pct' | 'min_roi_pct';
}

@Injectable()
export class MarketExportService {
    constructor(private readonly marketRepository: MarketRepository) {}

    async exportTopN(params: MarketExportParams): Promise<string> {
        const { startDate, endDate, exchange, timezone, topN, dedupSymbol, sortBy } = params;

        // 1. Fetch Data
        const results = await this.marketRepository.findTradeResultsInRange(exchange, startDate, endDate);

        if (!results || results.length === 0) {
            return '';
        }

        // 2. Group by Timezone adjusted Hourly Bucket
        const buckets = new Map<string, TradeResult[]>();

        for (const trade of results) {
            const bucketKey = this.getBucketKey(trade.entry_time, timezone);
            if (!buckets.has(bucketKey)) {
                buckets.set(bucketKey, []);
            }
            buckets.get(bucketKey)?.push(trade);
        }

        // 3. Process each bucket (Dedup -> Sort -> TopN)
        // Sort buckets by time
        const sortedKeys = Array.from(buckets.keys()).sort();

        let tsvOutput = '';

        for (const key of sortedKeys) {
            let items = buckets.get(key) || [];

            // Dedup by symbol (keep best performing one based on sortBy field)
            if (dedupSymbol) {
                const symbolMap = new Map<string, TradeResult>();
                for (const item of items) {
                    const existing = symbolMap.get(item.symbol);
                    if (!existing) {
                        symbolMap.set(item.symbol, item);
                    } else {
                        const currentVal = parseFloat(item[sortBy] || '-9999');
                        const existingVal = parseFloat(existing[sortBy] || '-9999');
                        if (currentVal > existingVal) {
                            symbolMap.set(item.symbol, item);
                        }
                    }
                }
                items = Array.from(symbolMap.values());
            }

            // Sort
            items.sort((a, b) => {
                const valA = parseFloat(a[sortBy] || '-9999');
                const valB = parseFloat(b[sortBy] || '-9999');
                return valB - valA; // Descending
            });

            // Top N
            const topItems = items.slice(0, topN);

            // 4. Format Output
            // Header
            tsvOutput += `[${key}]\n`;
            tsvOutput += `코인명\t현재가\t최대상승\t최대하락\t매도당시\n`;

            for (const item of topItems) {
                const symbol = item.symbol;
                const entryPrice = item.entry_price || '0';
                const maxRoi = item.max_roi_pct ? parseFloat(item.max_roi_pct).toFixed(5) : '';
                const minRoi = item.min_roi_pct ? parseFloat(item.min_roi_pct).toFixed(5) : '';
                const exitRoi = item.exit_roi_pct ? parseFloat(item.exit_roi_pct).toFixed(5) : '';

                tsvOutput += `${symbol}\t${entryPrice}\t${maxRoi}\t${minRoi}\t${exitRoi}\n`;
            }

            tsvOutput += '\n'; // Empty line between sections
        }

        return tsvOutput;
    }

    private getBucketKey(date: Date, timezone: string): string {
        // Format: YYYY-MM-DD HH:00
        // Use Intl.DateTimeFormat to convert to target timezone parts
        const formatter = new Intl.DateTimeFormat('en-CA', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            hourCycle: 'h23',
            timeZone: timezone,
        });

        // parts: { type: 'year', value: '2026' }, ...
        // en-CA format is usually: 2026-01-04, 13
        // But Intl formatToParts is safer.
        const parts = formatter.formatToParts(date);
        const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

        const y = getPart('year');
        const m = getPart('month');
        const d = getPart('day');
        const h = getPart('hour'); // This might be '24' if not careful with hourCycle, but h23 should give 00-23.

        // Note: Chrome/Node sometimes behaves weirdly with h23 on midnight (24 vs 00).
        // Let's verify standard behavior. h23 usually 00-23.

        return `${y}-${m}-${d} ${h}:00`;
    }
}
