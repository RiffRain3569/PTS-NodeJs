import { Body, Controller, Delete, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { OrderService } from './order.service';

@Controller('order')
export class OrderController {
    constructor(private readonly orderService: OrderService) {}

    @Post('bithumb/bid/top/:num')
    async bidBithumbTop(@Param('num') num: string, @Res() res: Response) {
        try {
            const result = await this.orderService.bidBithumbTop(Number(num));
             res.json(result);
        } catch(error) { res.status(500).json(error); }
    }

    @Post('bithumb/bid/top5')
    async bidBithumbTop5(@Res() res: Response) {
        try {
            const result = await this.orderService.bidBithumbTop5();
            res.json(result);
        } catch(error) { res.status(500).json(error); }
    }

    @Post('bithumb/ask/limit')
    async askBithumbLimit(@Body() body: any, @Res() res: Response) {
        try {
            const { markets, percent } = body;
            const result = await this.orderService.askBithumbLimit(markets, Number(percent));
            res.json(result);
        } catch(error) { res.status(500).json(error); }
    }

    @Delete('bithumb')
    async deleteBithumbOrder(@Res() res: Response) {
         try {
            const result = await this.orderService.deleteBithumbOrders();
            res.json(result);
        } catch(error) { res.status(500).json(error); }
    }

    @Post('bithumb/ask')
    async askBithumbMarket(@Body() body: any, @Res() res: Response) {
         try {
             const { markets } = body;
            const result = await this.orderService.askBithumbMarket(markets);
            res.json(result);
        } catch(error) { res.status(500).json(error); }
    }

    @Post('bitget/:blockchainSymbol')
    async handleBitgetSignal(@Param('blockchainSymbol') blockchainSymbol: string, @Body() body: any, @Res() res: Response) {
         try {
            const { message } = body;
            const result = await this.orderService.handleBitgetSignal(blockchainSymbol, message);
            res.json(result);
        } catch(error) { res.status(500).json(error); }
    }
}
