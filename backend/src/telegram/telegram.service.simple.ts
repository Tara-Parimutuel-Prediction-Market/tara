import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../entities/user.entity";
import { Market } from "../entities/market.entity";
import { Bet, BetStatus } from "../entities/bet.entity";

@Injectable()
export class TelegramSimpleService {
  private readonly logger = new Logger(TelegramSimpleService.name);
  private readonly botToken: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {
    this.botToken = this.configService.get<string>("TELEGRAM_BOT_TOKEN");
  }

  /** Send a message using built-in fetch — no axios/HttpService dependency. */
  async sendMessage(chatId: number, text: string): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`Telegram sendMessage HTTP ${res.status}: ${body}`);
        return;
      }
      this.logger.log(`Message sent to chat ${chatId}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to send message to chat ${chatId}: ${error.message}`,
      );
    }
  }

  async sendMarketAnnouncement(market: Market): Promise<void> {
    // Simple implementation without complex queries
    const message = `🚀 <b>NEW MARKET</b>\n\n📊 ${market.title}\n⏰ Closes: ${new Date(market.closesAt).toLocaleString()}`;

    // Send to a hardcoded chat ID for now (you can make this dynamic later)
    await this.sendMessage(123456789, message);

    this.logger.log(`Market announcement sent: ${market.title}`);
  }

  async sendBetResult(bet: Bet, market: Market): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: bet.userId },
    });

    if (!user?.telegramId) return;

    const result = bet.status === BetStatus.WON ? "✅ WON" : "❌ LOST";
    const message = `🎯 <b>Bet Result</b>\n\n📊 ${market.title}\n📈 Result: ${result}\n💰 Amount: $${bet.amount}`;

    await this.sendMessage(Number(user.telegramId), message);

    this.logger.log(`Bet result sent to user ${user.id}: ${bet.status}`);
  }
}
