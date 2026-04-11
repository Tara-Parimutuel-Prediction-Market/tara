import { Controller, Get, Post, Body, Headers, UnauthorizedException, UseGuards } from "@nestjs/common";
import { timingSafeEqual } from "crypto";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { JwtAuthGuard, AdminGuard } from "../auth/guards";
import { TelegramSimpleService } from "../telegram/telegram.service.simple";
import { TelegramVerificationService } from "../telegram/telegram-verification.service";
import { User } from "../entities/user.entity";
import { Market, MarketStatus } from "../entities/market.entity";

@ApiTags("Bot")
@Controller("bot")
export class BotController {
  constructor(
    private readonly telegramSimpleService: TelegramSimpleService,
    private readonly telegramVerificationService: TelegramVerificationService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Market) private readonly marketRepo: Repository<Market>,
  ) {}

  @Get("info")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: "Verify bot token is working" })
  @ApiResponse({ status: 200, description: "Bot info retrieved successfully" })
  async getBotInfo() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return { error: "Bot token not configured" };

    try {
      // Use built-in fetch
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
  async handleWebhook(
    @Body() update: any,
    @Headers("x-telegram-bot-api-secret-token") secretToken: string | undefined,
  ) {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expected) {
      const expectedBuf = Buffer.from(expected);
      const receivedBuf = Buffer.from(secretToken || "");
      const valid =
        expectedBuf.length === receivedBuf.length &&
        timingSafeEqual(expectedBuf, receivedBuf);
      if (!valid) throw new UnauthorizedException("Invalid webhook token");
    }
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

    // Handle shared contact (phone verification)
    if (message.contact) {
      const contact = message.contact;
      try {
        // contact.user_id is optional in the Telegram API — fall back to
        // the sender's ID so the security check in linkTelegramPhone always
        // passes for a user sharing their own contact via request_contact.
        const contactUserId =
          contact.user_id != null
            ? String(contact.user_id)
            : String(message.from.id);
        const result = await this.telegramVerificationService.linkTelegramPhone(
          String(message.from.id),
          String(chatId),
          contactUserId,
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

    // Handle text commands
    if (message.text) {
      switch (message.text) {
        case "/start": {
          const miniAppUrl = process.env.TELEGRAM_MINI_APP_URL || "";
          const channelUrl = process.env.TELEGRAM_CHANNEL_URL || "";
          const botToken = process.env.TELEGRAM_BOT_TOKEN;
          const payload: Record<string, unknown> = {
            chat_id: chatId,
            text:
              "🎯 <b>Welcome to Oro!</b>\n\n" +
              "To enable secure payments, please verify your phone:\n" +
              "👉 Type /verify and share your phone number.\n\n" +
              "Other commands:\n" +
              "/predict - View active markets\n" +
              "/help    - Show all commands",
            parse_mode: "HTML",
          };
          const buttons: { text: string; url: string }[] = [];
          if (miniAppUrl) buttons.push({ text: "🚀 Open Oro", url: miniAppUrl });
          if (channelUrl) buttons.push({ text: "📢 Join Channel", url: channelUrl });
          if (buttons.length) {
            payload.reply_markup = { inline_keyboard: [buttons] };
          }
          const startRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!startRes.ok) {
            console.error(`[Bot] /start sendMessage failed: ${await startRes.text()}`);
          }
          break;
        }

        case "/verify":
          await this.handleVerifyCommand(chatId, message.from.id);
          break;

        case "/predict":
          await this.handlePredictCommand(chatId, message.from.id);
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

  private async handlePredictCommand(chatId: number, telegramUserId?: number) {
    const markets = await this.marketRepo.find({
      where: [{ status: MarketStatus.OPEN }, { status: MarketStatus.RESOLVING }],
      order: { closesAt: "ASC" },
      take: 5,
    });

    if (!markets.length) {
      await this.telegramSimpleService.sendMessage(chatId, "📊 No active markets right now. Check back soon!");
      return;
    }

    const miniAppUrl = process.env.TELEGRAM_MINI_APP_URL || "";
    const lines = markets.map((m) => {
      const closes = m.closesAt ? new Date(m.closesAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "TBD";
      const statusIcon = m.status === MarketStatus.RESOLVING ? "⚖️" : "🟢";
      return `${statusIcon} <b>${m.title}</b>\n⏰ ${closes}`;
    });

    // ── Reputation teaser / status ────────────────────────────────────────────
    let reputationLine = "";
    if (telegramUserId) {
      const user = await this.userRepo.findOne({
        where: { telegramId: String(telegramUserId) },
        select: ["reputationTier", "totalPredictions", "reputationScore"],
      });
      if (!user || (user.totalPredictions ?? 0) === 0) {
        reputationLine =
          "\n\n⭐ <i>Make your first prediction to start building your reputation score. Top predictors carry more weight in market probabilities.</i>";
      } else {
        const tierLabel =
          user.reputationTier === "legend" ? "Legend" :
          user.reputationTier === "hot_hand" ? "Hot Hand" :
          user.reputationTier === "sharpshooter" ? "Sharpshooter" : "Rookie";
        const pct = user.reputationScore != null
          ? ` · ${Math.round(user.reputationScore * 100)}% accuracy`
          : "";
        reputationLine = `\n\n⭐ Your tier: <b>${tierLabel}</b>${pct} (${user.totalPredictions} predictions)`;
      }
    }

    const text = `📊 <b>Active Markets</b>\n\n${lines.join("\n\n")}\n\n👉 <a href="${miniAppUrl}">Place your prediction</a>${reputationLine}`;
    await this.telegramSimpleService.sendMessage(chatId, text);
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
          "1️⃣ Open the <b>Oro Mini App</b>\n" +
          "2️⃣ Go to <b>Profile → Link DK Bank Account</b>\n" +
          "3️⃣ Enter your <b>11-digit CID number</b>\n" +
          "4️⃣ Come back here and type /verify again.",
      );
      return;
    }

    // CID is linked but DK Bank may not have a phone on record
    if (!user.dkPhoneHash) {
      await this.telegramSimpleService.sendMessage(
        chatId,
        "⚠️ <b>No phone number found on your DK Bank account</b>\n\n" +
          "Your CID is linked, but DK Bank has no registered phone number for it.\n\n" +
          "Please visit a <b>DK Bank branch</b> to register your phone number, then type /verify again.",
      );
      return;
    }

    if (
      user.telegramPhoneHash &&
      user.dkPhoneHash &&
      user.telegramPhoneHash === user.dkPhoneHash
    ) {
      await this.telegramSimpleService.sendMessage(
        chatId,
        "✅ <b>Your phone is already verified!</b>\n\n" +
          "Your Telegram account is securely linked to your DK Bank account.\n" +
          "You're all set to make payments on Oro.",
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
        "To secure your payments, Oro needs to confirm your phone number matches " +
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
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) {
        console.error(`[Bot] sendPhoneRequest failed ${res.status}: ${await res.text()}`);
      }
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
