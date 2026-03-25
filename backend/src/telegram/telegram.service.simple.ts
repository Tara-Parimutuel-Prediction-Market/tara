import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HttpService } from '@nestjs/axios'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'
import { Market, MarketStatus } from '../entities/market.entity'
import { Bet, BetStatus } from '../entities/bet.entity'

@Injectable()
export class TelegramSimpleService {
  private readonly logger = new Logger(TelegramSimpleService.name)
  private readonly botToken: string

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN')
  }

  async sendMessage(chatId: number, text: string): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`
      const payload = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      }

      await this.httpService.post(url, payload)
      this.logger.log(`Message sent to chat ${chatId}: ${text}`)
    } catch (error) {
      this.logger.error(`Failed to send message to chat ${chatId}`, error)
    }
  }

  async sendMarketAnnouncement(market: Market): Promise<void> {
    // Simple implementation without complex queries
    const message = `🚀 <b>NEW MARKET</b>\n\n📊 ${market.title}\n⏰ Closes: ${new Date(market.closesAt).toLocaleString()}`
    
    // Send to a hardcoded chat ID for now (you can make this dynamic later)
    await this.sendMessage(123456789, message)
    
    this.logger.log(`Market announcement sent: ${market.title}`)
  }

  async sendBetResult(bet: Bet, market: Market): Promise<void> {
    const user = await this.userRepository.findOne({ 
      where: { id: bet.userId } 
    })
    
    if (!user?.telegramChatId) return

    const result = bet.status === BetStatus.WON ? '✅ WON' : '❌ LOST'
    const message = `🎯 <b>Bet Result</b>\n\n📊 ${market.title}\n📈 Result: ${result}\n💰 Amount: $${bet.amount}`
    
    await this.sendMessage(user.telegramChatId, message)
    
    this.logger.log(`Bet result sent to user ${user.id}: ${bet.status}`)
  }
}
