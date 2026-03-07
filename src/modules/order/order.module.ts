import { Module } from '@nestjs/common';
import { MarketModule } from '../market/market.module'; // Depend on MarketModule
import { OrderController } from './order.controller';
import { BitgetOrderService } from './providers/bitget-order.service';
import { BithumbOrderService } from './providers/bithumb-order.service';
import { UpbitOrderService } from './providers/upbit-order.service';

@Module({
    imports: [MarketModule],
    controllers: [OrderController],
    providers: [BithumbOrderService, BitgetOrderService, UpbitOrderService],
    exports: [BithumbOrderService, BitgetOrderService, UpbitOrderService],
})
export class OrderModule {}
