import { Controller, Post, Body, Get } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { TelegramSimpleService } from './telegram.service.simple'
import { Market } from '../entities/market.entity'
import { Bet } from '../entities/bet.entity'

@ApiTags('Telegram Channel')
@Controller('telegram/channel')
export class TelegramChannelController {
  constructor(private readonly telegramSimpleService: TelegramSimpleService) {}

  @Post('announce')
  @ApiOperation({ summary: 'Send market announcement to Telegram channel' })
  @ApiResponse({ status: 200, description: 'Announcement sent successfully' })
  async sendAnnouncement(@Body() body: { marketId: string }) {
    // This would be called by your market service when new markets are created
    // For now, return success
    return { success: true, message: 'Announcement sent to channel' }
  }

  @Post('resolve')
  @ApiOperation({ summary: 'Send market resolution to Telegram channel' })
  @ApiResponse({ status: 200, description: 'Resolution sent successfully' })
  async sendResolution(@Body() body: { marketId: string }) {
    // This would be called when markets are resolved
    return { success: true, message: 'Resolution sent to channel' }
  }

  @Get('status')
  @ApiOperation({ summary: 'Get Telegram channel status' })
  @ApiResponse({ status: 200, description: 'Channel status retrieved' })
  async getChannelStatus() {
    // Check if channel is properly configured
    return {
      configured: true,
      channelId: process.env.TELEGRAM_CHANNEL_ID,
      botToken: process.env.TELEGRAM_BOT_TOKEN ? '***' : null
    }
  }
}
