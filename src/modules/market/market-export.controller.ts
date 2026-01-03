import { BadRequestException, Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { MarketExportService } from './market-export.service';

@Controller('market')
export class MarketExportController {
    constructor(private readonly exportService: MarketExportService) {}

    @Get('export/:exchange/top')
    async exportTop(@Param('exchange') exchange: string, @Query() query: any, @Res() res: Response) {
        try {
            const {
                date,
                startDate,
                endDate,
                timezone = 'UTC',
                marketType,
                topN = 5,
                dedupSymbol = 'true',
                sortBy = 'exit_roi_pct',
                hour,
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
                // Let's assume input dates are UTC-based dates (YYYY-MM-DD 00:00:00 UTC).
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

            let parsedHour: number | undefined;
            if (hour !== undefined) {
                parsedHour = parseInt(hour, 10);
                if (isNaN(parsedHour) || parsedHour < 0 || parsedHour > 23) {
                    throw new BadRequestException('Invalid hour. Must be 0-23');
                }
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
                hour: parsedHour,
            });

            // 4. Response
            const filenameDate = startDate || date || 'export';
            const filename = `top${parsedTopN}_${exchange}_${filenameDate}${
                parsedHour !== undefined ? `_h${parsedHour}` : ''
            }.txt`;

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
