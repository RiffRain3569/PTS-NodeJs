import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { MarketService } from './market.service';

@Controller('market')
export class MarketController {
    constructor(private readonly marketService: MarketService) {}

    @Get('bithumb/top5')
    async getTop5(@Res() res: Response) {
        try {
            const data = await this.marketService.getTop5Markets();
            res.json(data);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    @Get('bitget/top5')
    async getBitgetTop5(@Res() res: Response) {
        try {
            const data = await this.marketService.getBitgetTop5Markets();
            res.json(data);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    @Post('job/run')
    async runJob(@Body() body: any, @Res() res: Response) {
        try {
            const { exchange, symbol, base_time, holding_minutes, side } = body;
            const baseTime = new Date(base_time);

            await this.marketService.calculateTradeResult(exchange, symbol, baseTime, {
                holdingMinutes: holding_minutes ? parseInt(holding_minutes) : undefined,
                side: side,
            });

            res.json({ status: 'OK', message: 'Job executed successfully' });
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }
}
