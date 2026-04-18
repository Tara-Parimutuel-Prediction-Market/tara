import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository, InjectDataSource } from "@nestjs/typeorm";
import { Repository, DataSource, Not, IsNull, MoreThan, Between } from "typeorm";
import { User } from "../entities/user.entity";
import { Transaction, TransactionType } from "../entities/transaction.entity";
import { TelegramSimpleService } from "../telegram/telegram.service.simple";

// Credits sent to lapsed users at each inactivity milestone
const REENGAGEMENT_CREDITS: Record<number, number> = {
  14: 15, // Nu 15 comeback credit
  30: 20, // Nu 20 "we miss you" credit
};

@Injectable()
export class EngagementJob {
  private readonly logger = new Logger(EngagementJob.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,
    @InjectDataSource() private dataSource: DataSource,
    private readonly telegram: TelegramSimpleService,
  ) {}

  /**
   * Re-engagement cron — runs 3:00 AM UTC daily.
   * Finds users who went silent at exactly the 2, 7, 14, or 30-day mark.
   * Uses a 1-day window per milestone so each user is messaged exactly once.
   *
   * 2 days  → urgency DM with a market closing soon (if any)
   * 7 days  → reputation decay warning
   * 14 days → Nu 15 comeback credit + DM
   * 30 days → Nu 20 "we miss you" credit + DM
   */
  @Cron("0 3 * * *")
  async reEngageLapsedUsers(): Promise<void> {
    await Promise.all([
      this.messageWindow(14),
      this.messageWindow(30),
    ]);
  }

  private async messageWindow(daysMissed: number): Promise<void> {
    const now = new Date();

    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() - daysMissed);

    const windowStart = new Date(windowEnd);
    windowStart.setDate(windowStart.getDate() - 1);

    const users = await this.userRepo.find({
      where: {
        lastActiveAt: Between(windowStart, windowEnd),
        telegramChatId: Not(IsNull()),
        totalPredictions: MoreThan(0),
      },
      select: ["id", "telegramChatId", "firstName", "reputationTier"],
    });

    if (users.length === 0) return;

    this.logger.log(
      `[ReEngagement] ${daysMissed}d lapsed — messaging ${users.length} users`,
    );

    const creditAmount = REENGAGEMENT_CREDITS[daysMissed] ?? 0;

    for (const user of users) {
      try {
        const chatId = Number(user.telegramChatId);
        if (!chatId) continue;

        const name = user.firstName ?? "Predictor";
        const msg = this.buildMessage(name, daysMissed, creditAmount, user.reputationTier);

        if (creditAmount > 0) {
          await this.creditUser(
            user.id,
            creditAmount,
            `Re-engagement credit (${daysMissed}d inactive)`,
          );
        }

        await this.telegram.sendMessage(chatId, msg);
      } catch (err: any) {
        this.logger.error(
          `[ReEngagement] Failed for user ${user.id}: ${err.message}`,
        );
      }
    }
  }

  private buildMessage(
    name: string,
    daysMissed: number,
    creditAmount: number,
    tier: string,
  ): string {
    if (daysMissed === 14) {
      return (
        `${name}, it's been 2 weeks. We've added <b>Nu ${creditAmount}</b> to your Oro wallet ` +
        `to get you back in the game. Your prediction record is still waiting.`
      );
    }

    return (
      `${name}, a month away from Oro. We've added <b>Nu ${creditAmount}</b> to your wallet — ` +
      `one prediction is all it takes to restart your journey.`
    );
  }

  private async creditUser(
    userId: string,
    amount: number,
    note: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      const { balance: rawBefore } = await em
        .getRepository(Transaction)
        .createQueryBuilder("t")
        .select("COALESCE(SUM(t.amount), 0)", "balance")
        .where("t.userId = :userId", { userId })
        .getRawOne();

      const balanceBefore = Number(rawBefore);

      await em.save(
        em.create(Transaction, {
          type: TransactionType.FREE_CREDIT,
          amount,
          balanceBefore,
          balanceAfter: balanceBefore + amount,
          userId,
          isBonus: true,
          note,
        }),
      );

      await em
        .createQueryBuilder()
        .update(User)
        .set({ bonusBalance: () => `"bonusBalance" + ${amount}` })
        .where("id = :userId", { userId })
        .execute();
    });
  }
}
