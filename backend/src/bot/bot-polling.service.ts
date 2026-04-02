import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { TelegramSimpleService } from "../telegram/telegram.service.simple";
import { TelegramVerificationService } from "../telegram/telegram-verification.service";
import { User } from "../entities/user.entity";

/**
 * BotPollingService
 *
 * Automatically switches the bot between two modes:
 *
 *  • WEBHOOK mode  — when TELEGRAM_WEBHOOK_URL is set to a real https:// URL.
 *    The service registers the webhook with Telegram and then does nothing —
 *    updates arrive via POST /api/bot/webhook.
 *
 *  • POLLING mode  — when TELEGRAM_WEBHOOK_URL is absent or still the
 *    placeholder "https://your-domain.com/…".
 *    The service clears any registered webhook and starts a getUpdates
 *    long-polling loop so contact shares and commands work locally without
 *    needing ngrok.
 *
 * Both modes share the same message-handling logic as BotController so
 * behaviour is identical in dev and production.
 */
@Injectable()
export class BotPollingService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(BotPollingService.name);
  private botToken: string;
  private pollingActive = false;
  private offset = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly telegramSimple: TelegramSimpleService,
    private readonly telegramVerification: TelegramVerificationService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async onApplicationBootstrap() {
    this.botToken =
      this.config.get<string>("TELEGRAM_BOT_TOKEN") ||
      process.env.TELEGRAM_BOT_TOKEN ||
      "";
    if (!this.botToken) {
      this.logger.warn("[Bot] TELEGRAM_BOT_TOKEN not set — bot disabled.");
      return;
    }

    const webhookUrl = this.config.get<string>("TELEGRAM_WEBHOOK_URL") || "";
    const isRealWebhook =
      webhookUrl.startsWith("https://") &&
      !webhookUrl.includes("your-domain.com");

    if (isRealWebhook) {
      await this.registerWebhook(webhookUrl);
    } else {
      this.logger.log(
        "[Bot] No real webhook URL configured — starting getUpdates polling loop.",
      );
      await this.clearWebhook();
      this.pollingActive = true;
      this.poll();
    }
  }

  onApplicationShutdown() {
    this.pollingActive = false;
  }

  // ── Webhook registration ──────────────────────────────────────────────────

  private async registerWebhook(url: string) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${this.botToken}/setWebhook`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url,
            allowed_updates: ["message", "callback_query"],
          }),
        },
      );
      const data: any = await res.json();
      if (data.ok) {
        this.logger.log(`[Bot] Webhook registered: ${url}`);
      } else {
        this.logger.error(
          `[Bot] Failed to register webhook: ${JSON.stringify(data)}`,
        );
      }
    } catch (err: any) {
      this.logger.error(`[Bot] Webhook registration error: ${err.message}`);
    }
  }

  private async clearWebhook() {
    try {
      await fetch(
        `https://api.telegram.org/bot${this.botToken}/deleteWebhook`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ drop_pending_updates: false }),
        },
      );
      this.logger.log("[Bot] Webhook cleared — polling mode active.");
    } catch (err: any) {
      this.logger.warn(`[Bot] Could not clear webhook: ${err.message}`);
    }
  }

  // ── Long-polling loop ─────────────────────────────────────────────────────

  private async poll() {
    while (this.pollingActive) {
      try {
        const res = await fetch(
          `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.offset}&timeout=30&allowed_updates=["message","callback_query"]`,
        );
        if (!res.ok) {
          this.logger.warn(
            `[Bot] getUpdates HTTP ${res.status} — retrying in 5s`,
          );
          await this.sleep(5000);
          continue;
        }

        const data: any = await res.json();
        if (!data.ok) {
          this.logger.warn(
            `[Bot] getUpdates error: ${JSON.stringify(data)} — retrying in 5s`,
          );
          await this.sleep(5000);
          continue;
        }

        for (const update of data.result as any[]) {
          this.offset = update.update_id + 1;
          await this.dispatch(update);
        }
      } catch (err: any) {
        if (this.pollingActive) {
          this.logger.warn(
            `[Bot] Polling error: ${err.message} — retrying in 5s`,
          );
          await this.sleep(5000);
        }
      }
    }
  }

  // ── Shared dispatcher (same logic as BotController.handleWebhook) ─────────

  async dispatch(update: any) {
    if (update.message) {
      await this.handleMessage(update.message);
    }
    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
    }
  }

  private async handleMessage(message: any) {
    const chatId: number = message.chat.id;

    // ── Contact share → telegramPhoneHash ─────────────────────────────────
    if (message.contact) {
      const contact = message.contact;
      try {
        const result = await this.telegramVerification.linkTelegramPhone(
          String(message.from.id),
          String(chatId),
          String(contact.user_id),
          contact.phone_number,
        );
        await this.telegramSimple.sendMessage(chatId, result.message);
      } catch (err: any) {
        await this.telegramSimple.sendMessage(
          chatId,
          `❌ Verification failed: ${err?.message || "Unknown error"}\n\nPlease try again or contact support.`,
        );
      }
      return;
    }

    // ── Text commands ────────────────────────────────────────────────────
    if (message.text) {
      switch (message.text) {
        case "/start": {
          const miniAppUrl =
            this.config.get<string>("TELEGRAM_MINI_APP_URL") ||
            process.env.TELEGRAM_MINI_APP_URL ||
            "";
          await fetch(
            `https://api.telegram.org/bot${this.botToken}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text:
                  "🎯 <b>Welcome to Tara!</b>\n\n" +
                  "To enable secure payments, please verify your phone:\n" +
                  "👉 Type /verify and share your phone number.\n\n" +
                  "Other commands:\n" +
                  "/predict - View active markets\n" +
                  "/help    - Show all commands",
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "🚀 Open Tara", url: miniAppUrl }],
                  ],
                },
              }),
            },
          );
          break;
        }

        case "/verify":
          await this.handleVerifyCommand(chatId, message.from.id);
          break;

        case "/predict":
          await this.telegramSimple.sendMessage(
            chatId,
            "📊 Active markets will be shown here soon!",
          );
          break;

        case "/help":
          await this.telegramSimple.sendMessage(
            chatId,
            "🔧 <b>Available commands:</b>\n" +
              "/start   - Welcome message\n" +
              "/verify  - Link your DK Bank phone for secure payments\n" +
              "/predict - View active markets\n" +
              "/help    - Show this message",
          );
          break;

        default:
          await this.telegramSimple.sendMessage(
            chatId,
            "❓ Unknown command. Use /help to see available commands.",
          );
      }
    }
  }

  private async handleVerifyCommand(chatId: number, telegramUserId: number) {
    // Check if this Telegram user has a DK CID linked yet
    const user = await this.userRepo.findOneBy({
      telegramId: String(telegramUserId),
    });

    if (!user || !user.dkCid) {
      await this.telegramSimple.sendMessage(
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

    // CID is linked but DK Bank may not have a phone on record
    if (!user.dkPhoneHash) {
      await this.telegramSimple.sendMessage(
        chatId,
        "⚠️ <b>No phone number found on your DK Bank account</b>\n\n" +
          "Your CID is linked, but DK Bank has no registered phone number for it.\n\n" +
          "Please visit a <b>DK Bank branch</b> to register your phone number, then type /verify again.",
      );
      return;
    }

    if (user.telegramPhoneHash && user.telegramLinkedAt) {
      await this.telegramSimple.sendMessage(
        chatId,
        "✅ <b>Your phone is already verified!</b>\n\n" +
          "Your Telegram account is securely linked to your DK Bank account.\n" +
          "You're all set to make payments on Tara.",
      );
      return;
    }

    await this.sendPhoneRequest(chatId);
  }

  private async sendPhoneRequest(chatId: number) {
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
      await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch (err: any) {
      this.logger.error(`[Bot] Failed to send phone request: ${err.message}`);
    }
  }

  private async handleCallbackQuery(callback: any) {
    if (callback.data) {
      await this.telegramSimple.sendMessage(
        callback.message.chat.id,
        `🎯 You selected: ${callback.data}`,
      );
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
