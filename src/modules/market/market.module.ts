import { Module } from '@nestjs/common';
import { MarketRepository } from './infrastructure/market.repository';
import { MarketExportController } from './market-export.controller';
import { MarketExportService } from './market-export.service';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';

@Module({
    controllers: [MarketController, MarketExportController],
    providers: [MarketService, MarketRepository, MarketExportService],
    exports: [MarketService, MarketRepository, MarketExportService],
})
export class MarketModule {}
