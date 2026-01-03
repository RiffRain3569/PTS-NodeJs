import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { MarketExportService } from './market-export.service';

@Controller('market')
export class MarketExportController {
    constructor(private readonly exportService: MarketExportService) {}

    @Get('export/top')
    async exportTop(@Query() query: any, @Res() res: Response) {
        try {
            const {
                date,
                startDate,
                endDate,
                exchange = 'bitget',
                timezone = 'UTC',
                marketType,
                topN = 5,
                dedupSymbol = 'true',
                sortBy = 'exit_roi_pct',
            } = query;

            // 1. Date Range Logic
            let finalStartDate: Date;
            let finalEndDate: Date;

            if (startDate) {
                finalStartDate = new Date(`${startDate}T00:00:00Z`); // Treat input as UTC date part or handle correctly?
                // Actually user inputs YYYY-MM-DD.
                // If we assume user input is in 'timezone' context, it gets complicated.
                // Usually date params are interpreted as YYYY-MM-DD in the REQUARER's view?
                // BUT standard API practice: YYYY-MM-DD implies 00:00 to 23:59 of that day.
                // The task says "date=YYYY-MM-DD -> 00:00 ~ 23:59:59".
                // Let's interpret YYYY-MM-DD as simple string and construct ISO string.
                // However, since we compare against `entry_time` (stored as Date/UTC),
                // we should probably convert these bounds to UTC or rely on string comparison if DB supports it.
                // Best practice: Convert YYYY-MM-DD to start of day in the requested `timezone`, then convert that instant to UTC Date object for DB query.
                // BUT, to keep it simple and effective (and since DB might use UTC):
                // Let's assume input dates are UTC-based dates unless specified.
                // The prompt says "date=... specific day".
                // Let's treat them as UTC string for simplicity unless `timezone` suggests otherwise?
                // Actually, if I say "date=2026-01-04" and "timezone=Asia/Seoul", does it mean 2026-01-04 00:00 KST?
                // Usually yes.
                // Let's implement that: Parse YYYY-MM-DD as local time in `timezone`, then convert to UTC Date.

                // Helper to parse date in timezone
                // Wait, JS Date parsing is tricky with arbitrary timezones.
                // Easiest is to append offset.
                // But we don't know the offset easily without a lib (moment-timezone or luxon).
                // Existing package.json does NOT have luxon/moment.
                // It has `date-fns`? No.
                // It has `node-cron`, `qs`...
                // So I have to use standard Intl or assume UTC input.

                // User instruction "entry_time을 timezone 기준으로 변환 후" implies output processing.
                // For *Input* query, usually it's simplest to assume UTC 00:00 - 23:59 OR just match string if we were using string comparison.
                // Given constraints, I will assume inputs are UTC dates (YYYY-MM-DD 00:00:00 UTC).
                // If user wants KST range, they should shift date or we accept that limitation.
                // OR, simplest: YYYY-MM-DD is UTC.

                finalStartDate = new Date(`${startDate}T00:00:00Z`);

                if (endDate) {
                    finalEndDate = new Date(`${endDate}T23:59:59.999Z`);
                } else {
                    finalEndDate = new Date(`${startDate}T23:59:59.999Z`);
                }
            } else if (date) {
                finalStartDate = new Date(`${date}T00:00:00Z`);
                finalEndDate = new Date(`${date}T23:59:59.999Z`);
            } else {
                throw new BadRequestException('date or startDate/endDate is required');
            }

            if (isNaN(finalStartDate.getTime()) || isNaN(finalEndDate.getTime())) {
                throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
            }

            // 2. Validate Other Params
            const parsedTopN = parseInt(topN, 10);
            const isDedup = dedupSymbol === 'true';
            const validSortFields = ['exit_roi_pct', 'max_roi_pct', 'min_roi_pct'];
            if (!validSortFields.includes(sortBy)) {
                throw new BadRequestException(`Invalid sortBy. Must be one of ${validSortFields.join(', ')}`);
            }

            // 3. Call Service
            const tsvContent = await this.exportService.exportTopN({
                startDate: finalStartDate,
                endDate: finalEndDate,
                exchange,
                timezone,
                topN: parsedTopN,
                dedupSymbol: isDedup,
                sortBy: sortBy as any,
            });

            // 4. Response
            const filenameDate = startDate || date || 'export';
            const filename = `top${parsedTopN}_${exchange}_${filenameDate}.txt`;

            res.set({
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            });

            res.send(tsvContent);
        } catch (error: any) {
            console.error(error);
            res.status(error.status || 500).json({ error: error.message || 'Internal Server Error' });
        }
    }
}
