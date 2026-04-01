import { Controller, Get, Post, Body } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { TelegramSimpleService } from "../telegram/telegram.service.simple";
import { TelegramVerificationService } from "../telegram/telegram-verification.service";
import { User } from "../entities/user.entity";

@ApiTags("Bot")
@Controller("bot")
export class BotController {
  constructor(
    private readonly telegramSimpleService: TelegramSimpleService,
    private readonly telegramVerificationService: TelegramVerificationService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  @Get("info")
  @ApiOperation({ summary: "Verify bot token is working" })
  @ApiResponse({ status: 200, description: "Bot info retrieved successfully" })
  async getBotInfo() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return { error: "Bot token not configured" };

    try {
      // Use built-in fetch — no axios dependency
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getMe`,
      );
      const data = await response.json();
      if (!response.ok) return { error: "Invalid bot token", details: data };
      return data;
    } catch (err: any) {
      return { error: "Failed to reach Telegram API", details: err.message };
    }
  }

  @Post("webhook")
  @ApiOperation({ summary: "Handle Telegram webhook updates" })
  @ApiResponse({ status: 200, description: "Webhook processed successfully" })
  async handleWebhook(@Body() update: any) {
    if (update.message) {
      await this.handleMessage(update.message);
    }
    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
    }
    return { success: true };
  }

  private async handleMessage(message: any) {
    const chatId: number = message.chat.id;

    // ── Handle shared contact (phone verification) ─────────────────────────
    if (message.contact) {
      const contact = message.contact;
      try {
        const result = await this.telegramVerificationService.linkTelegramPhone(
          String(message.from.id),
          String(chatId),
          String(contact.user_id),
          contact.phone_number,
        );
        await this.telegramSimpleService.sendMessage(chatId, result.message);
      } catch (err: any) {
        await this.telegramSimpleService.sendMessage(
          chatId,
          `❌ Verification failed: ${err?.message || "Unknown error"}\n\nPlease try again or contact support.`,
        );
      }
      return;
    }

    // ── Handle text commands ────────────────────────────────────────────────
    if (message.text) {
      switch (message.text) {
        case "/start":
          await this.telegramSimpleService.sendMessage(
            chatId,
            "🎯 <b>Welcome to Tara!</b>\n\n" +
              "To enable secure payments, please verify your phone:\n" +
              "👉 Type /verify and share your phone number.\n\n" +
              "Other commands:\n" +
              "/predict - View active markets\n" +
              "/help    - Show all commands",
          );
          break;

        case "/verify":
          await this.handleVerifyCommand(chatId, message.from.id);
          break;

        case "/predict":
          await this.telegramSimpleService.sendMessage(
            chatId,
            "📊 Active markets will be shown here soon!",
          );
          break;

        case "/help":
          await this.telegramSimpleService.sendMessage(
            chatId,
            "🔧 <b>Available commands:</b>\n" +
              "/start   - Welcome message\n" +
              "/verify  - Link your DK Bank phone for secure payments\n" +
              "/predict - View active markets\n" +
              "/help    - Show this message",
          );
          break;

        default:
          await this.telegramSimpleService.sendMessage(
            chatId,
            "❓ Unknown command. Use /help to see available commands.",
          );
      }
    }
  }

  /**
   * Checks if the user has a DK CID linked before sending the phone-share keyboard.
   * Gives a clear step-by-step message if they haven't linked yet.
   */
  private async handleVerifyCommand(chatId: number, telegramUserId: number) {
    const user = await this.userRepo.findOneBy({
      telegramId: String(telegramUserId),
    });

    if (!user || !user.dkCid) {
      await this.telegramSimpleService.sendMessage(
        chatId,
        "⚠️ <b>DK Bank CID not linked yet</b>\n\n" +
          "Before verifying your phone, you need to link your DK Bank CID:\n\n" +
          "1️⃣ Open the <b>Tara Mini App</b>\n" +
          "2️⃣ Go to <b>Profile → Link DK Bank Account</b>\n" +
          "3️⃣ Enter your <b>11-digit CID number</b>\n" +
          "4️⃣ Come back here and type /verify again.",
      );
      return;
    }

    if (user.telegramPhoneHash && user.telegramLinkedAt) {
      await this.telegramSimpleService.sendMessage(
        chatId,
        "✅ <b>Your phone is already verified!</b>\n\n" +
          "Your Telegram account is securely linked to your DK Bank account.\n" +
          "You're all set to make payments on Tara.",
      );
      return;
    }

    await this.sendPhoneRequest(chatId);
  }

  /**
   * Sends a native Telegram "Share Phone Number" keyboard button.
   * Telegram verifies the phone on its end before sending the contact update.
   */
  private async sendPhoneRequest(chatId: number): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    const body = JSON.stringify({
      chat_id: chatId,
      text:
        "🔐 <b>Phone Verification Required</b>\n\n" +
        "To secure your payments, Tara needs to confirm your phone number matches " +
        "the one registered with DK Bank.\n\n" +
        "Tap the button below to share your phone number securely via Telegram.",
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [[{ text: "📱 Share Phone Number", request_contact: true }]],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    });

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch (err: any) {
      console.error("Failed to send phone request keyboard:", err.message);
    }
  }

  private async handleCallbackQuery(callback: any) {
    if (callback.data) {
      await this.telegramSimpleService.sendMessage(
        callback.message.chat.id,
        `🎯 You selected: ${callback.data}`,
      );
    }
  }
}
