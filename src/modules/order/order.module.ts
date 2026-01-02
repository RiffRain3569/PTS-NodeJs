import { Module } from '@nestjs/common';
import { MarketModule } from '../market/market.module'; // Depend on MarketModule
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [MarketModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
