import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { MarketsService } from "./markets.service";
import { MarketStatus } from "../entities/market.entity";

@Injectable()
export class KeeperService {
  private readonly logger = new Logger(KeeperService.name);

  constructor(private readonly marketsService: MarketsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleMarketExpirations() {
    this.logger.debug("Running Expiry Keeper...");
    
    // Fetch all markets
    const markets = await this.marketsService.findAll();
    const openMarkets = markets.filter(m => m.status === MarketStatus.OPEN);

    for (const market of openMarkets) {
      // Check if it should be closed
      if (new Date() > new Date(market.closesAt)) {
        this.logger.log(`Market ${market.id} ("${market.title}") reached deadline. Transitioning to CLOSED.`);
        await this.marketsService.transition(market.id, MarketStatus.CLOSED);
      }
    }
  }

  // Demo Liquidity Bot: Shifts odds slightly every 10 minutes to make the demo feel alive
  @Cron(CronExpression.EVERY_10_MINUTES)
  async simulateActivity() {
    // This can be expanded to place small bets using a bot user
    this.logger.debug("Running Liquidity Bot (Simulation)...");
  }
}
