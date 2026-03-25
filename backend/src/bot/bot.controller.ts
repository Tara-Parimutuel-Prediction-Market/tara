import { Controller, Get, Post, Body } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import * as fs from 'fs'
import * as path from 'path'
import { TelegramSimpleService } from '../telegram/telegram.service.simple'

// Manually load .env file
const envPath = path.resolve(process.cwd(), '.env')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars: Record<string, string> = envContent.split('\n').reduce((acc, line) => {
  const [key, value] = line.split('=')
  if (key && value) {
    acc[key.trim()] = value.trim()
  }
  return acc
}, {})

@ApiTags('Bot')
@Controller('bot')
export class BotController {
  constructor(private readonly telegramSimpleService: TelegramSimpleService) {}

  @Get('info')
  @ApiOperation({ summary: 'Verify bot token is working' })
  @ApiResponse({ status: 200, description: 'Bot info retrieved successfully' })
  async getBotInfo() {
    const botToken = envVars.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      return { error: 'Bot token not configured' };
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getMe`,
      );
      const data = await response.json();
      
      if (!response.ok) {
        return { error: 'Invalid bot token', details: data };
      }
      
      return data;
    } catch (err) {
      return { error: 'Failed to reach Telegram API', details: err.message };
    }
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Handle Telegram webhook updates' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(@Body() update: any) {
    console.log('Telegram update received:', JSON.stringify(update, null, 2));

    // Handle different types of updates
    if (update.message) {
      await this.handleMessage(update.message);
    }

    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
    }

    return { success: true };
  }

  private async handleMessage(message: any) {
    console.log('Received message:', message);

    // Handle commands
    if (message.text) {
      switch (message.text) {
        case '/start':
          await this.telegramSimpleService.sendMessage(
            message.chat.id,
            '🎯 Welcome to Tara! Use /predict to see active markets.'
          );
          break;
        case '/predict':
          await this.telegramSimpleService.sendMessage(
            message.chat.id,
            '📊 Active markets will be shown here soon!'
          );
          break;
        case '/help':
          await this.telegramSimpleService.sendMessage(
            message.chat.id,
            '🔧 Available commands:\n/start - Start bot\n/predict - View markets\n/help - Show help'
          );
          break;
        default:
          await this.telegramSimpleService.sendMessage(
            message.chat.id,
            '❓ Unknown command. Use /help to see available commands.'
          );
      }
    }
  }

  private async handleCallbackQuery(callback: any) {
    console.log('Received callback query:', callback);
    
    // Handle button clicks
    if (callback.data) {
      // Parse callback data and handle accordingly
      // Example: callback.data could be "market_123_yes" or "market_123_no"
      
      await this.telegramSimpleService.sendMessage(
        callback.message.chat.id,
        `🎯 You selected: ${callback.data}`
      );
    }
  }
}
