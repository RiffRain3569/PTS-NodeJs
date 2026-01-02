import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { MarketService } from './market.service';

@Controller('bithumb/market')
export class MarketController {
    constructor(private readonly marketService: MarketService) {}

    @Get('top5')
    async getTop5(@Res() res: Response) {
        try {
            const data = await this.marketService.getTop5Markets();
            res.json(data);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}
