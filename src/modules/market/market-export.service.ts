import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { TradeResult } from './domain/trade-result.entity';
import { MarketRepository } from './infrastructure/market.repository';

export interface MarketExportParams {
    startDate: Date;
    endDate: Date;
    exchange: string;
    timezone: string;
    topN: number;
    dedupSymbol: boolean;
    sortBy: 'exit_roi_pct' | 'max_roi_pct' | 'min_roi_pct' | 'id';
    targetHour?: number; // Local hour (0-23)
}

@Injectable()
export class MarketExportService {
    constructor(private readonly marketRepository: MarketRepository) {}

    async exportTopN(params: MarketExportParams): Promise<Buffer> {
        const { startDate, endDate, exchange, timezone, topN, dedupSymbol, sortBy, targetHour } = params;

        // Calculate UTC Hour if targetHour is provided
        // DB stores "Absolute/Local" time (naive). Do NOT convert targetHour to UTC.
        const queryHour = targetHour;

        // 1. Fetch Data
        console.log(`[Export] Querying: ${exchange}, ${startDate} ~ ${endDate}, HourFilter: ${targetHour ?? 'ALL'}`);
        const results = await this.marketRepository.findTradeResultsInRange(exchange, startDate, endDate, queryHour);
        console.log(`[Export] Found ${results ? results.length : 0} results`);

        if (!results || results.length === 0) {
            console.log('[Export] No data found, generating empty Excel');
            // throw new Error('No data found for the given criteria');
        }

        // 2. Filter only LONG and Group by Timezone adjusted Hourly Bucket
        const longResults = results.filter((r) => r.side === 'LONG');
        const buckets = new Map<string, TradeResult[]>();

        for (const trade of longResults) {
            // DB Date Object (e.g. 09:00Z) is actually 09:00 Local.
            // Just format the UTC components directly to keep "09:00".
            const bucketKey = this.getBucketKeyAsIs(trade.entry_time);
            if (!buckets.has(bucketKey)) {
                buckets.set(bucketKey, []);
            }
            buckets.get(bucketKey)?.push(trade);
        }

        // 3. Prepare Data for SheetJS
        const sortedKeys = Array.from(buckets.keys()).sort();
        const dataRows: any[][] = [];

        // Header
        const headerRow = ['Time'];
        for (let i = 1; i <= topN; i++) {
            headerRow.push(`${i}_코인명\n진입가`, `${i}_최대상승`, `${i}_최대하락`, `${i}_매도당시`);
        }
        dataRows.push(headerRow);

        // Rows
        for (const key of sortedKeys) {
            let items = buckets.get(key) || [];

            // Dedup
            if (dedupSymbol) {
                const symbolMap = new Map<string, TradeResult>();
                for (const item of items) {
                    const existing = symbolMap.get(item.symbol);
                    if (!existing) {
                        symbolMap.set(item.symbol, item);
                    } else {
                        let currentVal = 0;
                        let existingVal = 0;

                        if (sortBy === 'id') {
                            currentVal = item.id || 0;
                            existingVal = existing.id || 0;
                        } else {
                            const key = sortBy as keyof TradeResult;
                            currentVal = parseFloat((item[key] as string) || '-9999');
                            existingVal = parseFloat((existing[key] as string) || '-9999');
                        }

                        if (sortBy === 'id') {
                            // Keep smaller ID (First)
                            const keepCurrent = currentVal < existingVal;
                            if (keepCurrent) {
                                symbolMap.set(item.symbol, item);
                            }
                        } else {
                            // Keep Larger ROI
                            const keepCurrent = currentVal > existingVal;
                            if (keepCurrent) {
                                symbolMap.set(item.symbol, item);
                            }
                        }
                    }
                }
                items = Array.from(symbolMap.values());
            }

            // Sort
            items.sort((a, b) => {
                if (sortBy === 'id') {
                    const valA = a.id || 0;
                    const valB = b.id || 0;
                    return valA - valB;
                } else {
                    const key = sortBy as keyof TradeResult;
                    const rawA = a[key] as string | null;
                    const rawB = b[key] as string | null;

                    const valA = parseFloat(rawA || '-9999');
                    const valB = parseFloat(rawB || '-9999');
                    return valB - valA;
                }
            });

            const topItems = items.slice(0, topN);

            const row: any[] = [key];
            for (let i = 0; i < topN; i++) {
                const item = topItems[i];
                if (item) {
                    // Format: "Symbol\nEntryPrice" (Trimmed)
                    const entryPriceRaw = item.entry_price || '0';
                    const entryPriceTrimmed = parseFloat(entryPriceRaw).toString();
                    const symbolText = `${item.symbol}\n${entryPriceTrimmed}`;

                    const formatRoi = (val: string | number | null | undefined) => {
                        if (val === null || val === undefined || val === '') return '';
                        const num = typeof val === 'string' ? parseFloat(val) : val;
                        if (isNaN(num)) return '';

                        // Truncate to 2 decimal places (discard rest)
                        // Math.trunc works for both positive and negative
                        const truncated = Math.trunc(num * 100) / 100;
                        return `${truncated.toFixed(2)}%`;
                    };

                    const maxRoi = formatRoi(item.max_roi_pct);
                    const minRoi = formatRoi(item.min_roi_pct);
                    const exitRoi = formatRoi(item.exit_roi_pct);

                    row.push(symbolText, maxRoi, minRoi, exitRoi);
                } else {
                    row.push('', '', '', '');
                }
            }
            dataRows.push(row);
        }

        // 4. Create Workbook
        const ws = XLSX.utils.aoa_to_sheet(dataRows);

        // Basic Column Widths (optional)
        const wscols = [{ wch: 20 }]; // Time column
        for (let i = 0; i < topN * 4; i++) {
            wscols.push({ wch: 15 });
        }
        ws['!cols'] = wscols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Market Data');

        // 5. Generate Buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Ensure strictly Node Buffer
        return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    }

    private getUtcHour(localHour: number, timezone: string): number {
        // Find corresponding UTC hour for the given localHour in timezone
        // Iterate 0-23 UTC hours of a dummy day
        for (let h = 0; h < 24; h++) {
            const date = new Date(Date.UTC(2025, 0, 1, h, 0, 0)); // Jan 1st
            const parts = new Intl.DateTimeFormat('en-US', {
                hour: 'numeric',
                hourCycle: 'h23',
                timeZone: timezone,
            }).formatToParts(date);

            const tzHour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
            if (tzHour === localHour) {
                return h;
            }
        }
        return localHour; // Fallback
    }

    private getBucketKey(date: Date, timezone: string): string {
        try {
            // Basic implementation using Intl
            const formatter = new Intl.DateTimeFormat('en-CA', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                hourCycle: 'h23',
                timeZone: timezone,
            });

            const parts = formatter.formatToParts(date);
            const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

            const y = getPart('year');
            const mo = getPart('month');
            const d = getPart('day');
            const h = getPart('hour');
            const m = getPart('minute');

            // Return YYYY-MM-DD HH:mm
            return `${y}-${mo}-${d} ${h}:${m}`;
            // If we want seconds: return `${y}-${month}-${d} ${h}:${m}:${s}`;
        } catch (e) {
            // Fallback to UTC ISO string (YYYY-MM-DD HH:mm)
            return date.toISOString().slice(0, 16).replace('T', ' ');
        }
    }

    private getBucketKeyAsIs(date: Date): string {
        // Return YYYY-MM-DD HH:mm from "UTC" components directly
        // Because DB stores local time as UTC-date (e.g. 09:00 KST stored as 09:00Z)
        return date.toISOString().slice(0, 16).replace('T', ' ');
    }
}
