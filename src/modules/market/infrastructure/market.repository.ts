import { DatabaseService } from '@/modules/database/database.service';
import { Injectable } from '@nestjs/common';
import { TradeResult } from '../domain/trade-result.entity';

@Injectable()
export class MarketRepository {
    constructor(private readonly db: DatabaseService) {}

    async createJobRun(
        exchange: string,
        scheduleInterval: string,
        baseHoldingMinutes: number,
        priceBasis: string,
        timezone: string = 'UTC',
        note?: string
    ): Promise<number> {
        const sql = `
            INSERT INTO job_run 
            (exchange, schedule_interval, base_holding_minutes, price_basis, timezone, note)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const result = await this.db.execute(sql, [
            exchange,
            scheduleInterval,
            baseHoldingMinutes,
            priceBasis,
            timezone,
            note || null,
        ]);
        return result.insertId;
    }

    async saveTradeResult(data: TradeResult): Promise<void> {
        const sql = `
            INSERT INTO trade_result
            (exchange, market_type, symbol, side, entry_time, holding_minutes, 
             entry_price, exit_price, 
             max_roi_pct, min_roi_pct, exit_roi_pct, 
             max_price_during, min_price_during, 
             price_basis, timezone, status, note, run_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            exit_price = VALUES(exit_price),
            max_roi_pct = VALUES(max_roi_pct),
            min_roi_pct = VALUES(min_roi_pct),
            exit_roi_pct = VALUES(exit_roi_pct),
            max_price_during = VALUES(max_price_during),
            min_price_during = VALUES(min_price_during),
            note = VALUES(note),
            run_id = VALUES(run_id)
        `;

        await this.db.execute(sql, [
            data.exchange,
            data.market_type,
            data.symbol,
            data.side,
            data.entry_time,
            data.holding_minutes,
            data.entry_price,
            data.exit_price,
            data.max_roi_pct,
            data.min_roi_pct,
            data.exit_roi_pct,
            data.max_price_during,
            data.min_price_during,
            data.price_basis,
            data.timezone,
            data.status,
            data.note || null,
            data.run_id || null,
        ]);
    }

    async findTradeResult(
        exchange: string,
        symbol: string,
        side: string,
        entry_time: Date,
        holding_minutes: number
    ): Promise<TradeResult | null> {
        const sql = `
            SELECT * FROM trade_result
            WHERE exchange = ? AND symbol = ? AND side = ? AND entry_time = ? AND holding_minutes = ?
        `;
        // Time precision might require handling with moment or ISO string comparison depending on driver
        // For now relying on Date object compatibility
        const rows = await this.db.query(sql, [exchange, symbol, side, entry_time, holding_minutes]);
        return rows.length > 0 ? rows[0] : null;
    }

    async findTradeResultsInRange(
        exchange: string,
        startDate: Date,
        endDate: Date,
        hour?: number
    ): Promise<TradeResult[]> {
        let sql = `
            SELECT * FROM trade_result
            WHERE exchange = ? 
              AND status = 'OK'
              AND entry_time >= ? 
              AND entry_time <= ?
        `;
        const params: any[] = [exchange, startDate, endDate];

        if (hour !== undefined) {
            sql += ` AND HOUR(entry_time) = ?`;
            params.push(hour);
        }

        sql += ` ORDER BY entry_time ASC`;

        return await this.db.query(sql, params);
    }
}
