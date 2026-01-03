import { Module } from '@nestjs/common';
import { MarketRepository } from './infrastructure/market.repository';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';

@Module({
    controllers: [MarketController],
    providers: [MarketService, MarketRepository],
    exports: [MarketService, MarketRepository],
})
export class MarketModule {}
