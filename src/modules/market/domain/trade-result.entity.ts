export interface TradeResult {
    id?: number;
    exchange: 'bitget' | 'bithumb';
    market_type: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    entry_time: Date;
    holding_minutes: number;
    exit_time: Date;
    entry_price: string;
    exit_price: string | null;
    max_roi_pct: string | null;
    min_roi_pct: string | null;
    exit_roi_pct: string | null;
    max_price_during: string | null;
    min_price_during: string | null;
    price_basis: string;
    timezone: string;
    status: 'OK' | 'SKIPPED' | 'MISSING_DATA' | 'ERROR' | 'WAITING';
    note?: string;
    run_id?: number | null;
    created_at?: Date;
}
