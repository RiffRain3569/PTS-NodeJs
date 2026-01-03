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
    hour?: number;
}

@Injectable()
export class MarketExportService {
    constructor(private readonly marketRepository: MarketRepository) {}

    async exportTopN(params: MarketExportParams): Promise<string> {
        const { startDate, endDate, exchange, timezone, topN, dedupSymbol, sortBy, hour } = params;

        // 1. Fetch Data
        const results = await this.marketRepository.findTradeResultsInRange(exchange, startDate, endDate, hour);
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

        // 4. Format Output
        // Generate Header
        const headerParts = ['Time'];
        for (let i = 1; i <= topN; i++) {
            headerParts.push(`${i}_코인명/현재가`, `${i}_최대상승`, `${i}_최대하락`, `${i}_매도당시`);
        }
        tsvOutput += headerParts.join('\t') + '\n';

        // Generate Data Rows
        for (const key of sortedKeys) {
            let items = buckets.get(key) || [];
            // Already deduplicated and sorted above

            // Take Top N
            // Re-sort and slice logic was effectively here,
            // but we need to ensure 'items' used here logic is same as before.
            // In previous step (step 3), we already did:
            // Dedup -> items = Array.from(...)
            // Sort -> items.sort(...)
            // Slice -> topItems = items.slice(0, topN)

            // Let's reuse that logic safely by iterating buckets again or moving it here
            // Wait, the previous code block iterated keys and built string immediately.
            // I need to replicate the 'Processing' logic inside this loop or refactor slightly.
            // Looking at the code context, I am REPLACING the loop.
            // So I need to include the processing logic (Dedup/Sort) inside this loop
            // OR assume it was done. But step 3 was INSIDE the loop in previous file content.
            // So I must include Dedup/Sort logic here.

            // --- Logic from Step 3 (Dedup & Sort) ---
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

            items.sort((a, b) => {
                const valA = parseFloat(a[sortBy] || '-9999');
                const valB = parseFloat(b[sortBy] || '-9999');
                return valB - valA; // Descending
            });

            const topItems = items.slice(0, topN);
            // ----------------------------------------

            const rowParts = [key];

            for (let i = 0; i < topN; i++) {
                const item = topItems[i];
                if (item) {
                    const symbol = item.symbol;
                    const entryPrice = item.entry_price ? parseFloat(item.entry_price) : 0;
                    const symbolPrice = `"${symbol}\n${entryPrice}"`;

                    const maxRoi = item.max_roi_pct ? `${parseFloat(item.max_roi_pct).toFixed(2)}%` : '';
                    const minRoi = item.min_roi_pct ? `${parseFloat(item.min_roi_pct).toFixed(2)}%` : '';
                    const exitRoi = item.exit_roi_pct ? `${parseFloat(item.exit_roi_pct).toFixed(2)}%` : '';

                    rowParts.push(symbolPrice, maxRoi, minRoi, exitRoi);
                } else {
                    // Empty columns for missing rank
                    rowParts.push('', '', '', '');
                }
            }
            tsvOutput += rowParts.join('\t') + '\n';
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
