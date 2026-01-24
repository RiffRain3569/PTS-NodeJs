import { Body, Controller, Delete, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { BitgetOrderService } from './providers/bitget-order.service';
import { BithumbOrderService } from './providers/bithumb-order.service';

@Controller('order')
export class OrderController {
    constructor(
        private readonly bithumbOrderService: BithumbOrderService,
        private readonly bitgetOrderService: BitgetOrderService,
    ) {}

    @Post('bithumb/bid/top/:num')
    async bidBithumbTop(@Param('num') num: string, @Res() res: Response) {
        try {
            const result = await this.bithumbOrderService.bidBithumbTop(Number(num));
            res.json(result);
        } catch (error) {
            res.status(500).json(error);
        }
    }

    @Post('bithumb/bid/top5')
    async bidBithumbTop5(@Res() res: Response) {
        try {
            const result = await this.bithumbOrderService.bidBithumbTop5();
            res.json(result);
        } catch (error) {
            res.status(500).json(error);
        }
    }

    @Post('bithumb/ask/limit')
    async askBithumbLimit(@Body() body: any, @Res() res: Response) {
        try {
            const { markets, percent } = body;
            const result = await this.bithumbOrderService.askBithumbLimit(markets, Number(percent));
            res.json(result);
        } catch (error) {
            res.status(500).json(error);
        }
    }

    @Delete('bithumb')
    async deleteBithumbOrder(@Res() res: Response) {
        try {
            const result = await this.bithumbOrderService.deleteBithumbOrders();
            res.json(result);
        } catch (error) {
            res.status(500).json(error);
        }
    }

    @Post('bithumb/ask')
    async askBithumbMarket(@Body() body: any, @Res() res: Response) {
        try {
            const { markets } = body;
            const result = await this.bithumbOrderService.askBithumbMarket(markets);
            res.json(result);
        } catch (error) {
            res.status(500).json(error);
        }
    }

    @Post('bitget/:blockchainSymbol')
    async handleBitgetSignal(
        @Param('blockchainSymbol') blockchainSymbol: string,
        @Body() body: any,
        @Res() res: Response,
    ) {
        try {
            const { message } = body;
            const result = await this.bitgetOrderService.handleBitgetSignal(blockchainSymbol, message);
            res.json(result);
        } catch (error) {
            res.status(500).json(error);
        }
    }
}
