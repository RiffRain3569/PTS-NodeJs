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
    targetHours?: number[]; // Local hours (0-23)
    position?: 'LONG' | 'SHORT' | 'ALL';
}

@Injectable()
export class MarketExportService {
    constructor(private readonly marketRepository: MarketRepository) {}

    async exportTopN(params: MarketExportParams): Promise<Buffer> {
        const {
            startDate,
            endDate,
            exchange,
            timezone,
            topN,
            dedupSymbol,
            sortBy,
            targetHours,
            position = 'LONG',
        } = params;

        // 1. Fetch Data
        // If targetHours provided (or just generally), we fetch ALL for the date range
        // filtering by hour in memory avoids multiple DB calls.
        // If targetHour (singular) was passed, we could use it, but new logic prefers targetHours array.
        const queryHour = params.targetHour; // Legacy support if needed, but we likely ignore it if targetHours set.

        // If targetHours is set, we ignore queryHour in DB query to get all potential rows, then filter.
        // If targetHours is NOT set, we respect queryHour if present.
        const effectiveQueryHour = targetHours && targetHours.length > 0 ? undefined : queryHour;

        console.log(
            `[Export] Querying: ${exchange}, ${startDate} ~ ${endDate}, HourFilter: ${effectiveQueryHour ?? 'ALL'}`
        );
        const results = await this.marketRepository.findTradeResultsInRange(
            exchange,
            startDate,
            endDate,
            effectiveQueryHour
        );
        console.log(`[Export] Found ${results ? results.length : 0} results`);

        const wb = XLSX.utils.book_new();

        // Filter by Position
        const positionFiltered = (results || []).filter((r) => {
            if (position === 'ALL') return true;
            return r.side === position;
        });

        // Determine sheets to create
        if (targetHours && targetHours.length > 0) {
            for (const h of targetHours) {
                // Filter by hour (local/absolute hour from DB)
                // Use getUTCHours() because DB stores local time as UTC (Fake UTC)
                const hourData = positionFiltered.filter((r) => r.entry_time.getUTCHours() === h);
                this.createSheet(wb, hourData, `${h}시`, topN, dedupSymbol, sortBy);
            }
        } else {
            // Fallback or Single Sheet
            const sheetName = queryHour !== undefined ? `${queryHour}시` : 'All';
            this.createSheet(wb, positionFiltered, sheetName, topN, dedupSymbol, sortBy);
        }

        // 5. Generate Buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    }

    private createSheet(
        wb: XLSX.WorkBook,
        data: TradeResult[],
        sheetName: string,
        topN: number,
        dedupSymbol: boolean,
        sortBy: 'exit_roi_pct' | 'max_roi_pct' | 'min_roi_pct' | 'id'
    ) {
        const buckets = new Map<string, TradeResult[]>();

        for (const trade of data) {
            const bucketKey = this.getBucketKeyAsIs(trade.entry_time);
            if (!buckets.has(bucketKey)) {
                buckets.set(bucketKey, []);
            }
            buckets.get(bucketKey)?.push(trade);
        }

        const sortedKeys = Array.from(buckets.keys()).sort();
        const dataRows: any[][] = [];

        // Header
        const headerRow = ['Time'];
        for (let i = 1; i <= topN; i++) {
            headerRow.push(`${i}_코인명\n진입가`, `${i}_최대상승`, `${i}_최대하락`, `${i}_매도당시`);
        }
        dataRows.push(headerRow);

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
                            // Keep smaller ID
                            if (currentVal < existingVal) symbolMap.set(item.symbol, item);
                        } else {
                            // Keep Larger ROI
                            if (currentVal > existingVal) symbolMap.set(item.symbol, item);
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
                    const entryPriceRaw = item.entry_price || '0';
                    const entryPriceTrimmed = parseFloat(entryPriceRaw).toString();
                    const symbolText = `${item.symbol}\n${entryPriceTrimmed}`;

                    const formatRoi = (val: string | number | null | undefined) => {
                        if (val === null || val === undefined || val === '') return '';
                        const num = typeof val === 'string' ? parseFloat(val) : val;
                        if (isNaN(num)) return '';
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

        const ws = XLSX.utils.aoa_to_sheet(dataRows);
        const wscols = [{ wch: 20 }];
        for (let i = 0; i < topN * 4; i++) {
            wscols.push({ wch: 15 });
        }
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    private getBucketKeyAsIs(date: Date): string {
        // Return YYYY-MM-DD HH:mm from "UTC" components directly
        // Because DB stores local time as UTC-date (e.g. 09:00 KST stored as 09:00Z)
        return date.toISOString().slice(0, 16).replace('T', ' ');
    }
}
