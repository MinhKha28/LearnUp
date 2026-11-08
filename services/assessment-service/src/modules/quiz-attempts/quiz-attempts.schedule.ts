import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QuizAttemptSettler } from './quiz-attempt-settler';

/**
 * BR-200: an attempt whose time ran out is submitted by the system with the answers saved. This job does it for every
 * Learner, so the score and the lock are in place even when nobody opens the Quiz again. The reading of an attempt, the
 * lists and the completion snapshot settle the attempts they need as well, so the job only has to keep up in the
 * background. Running twice, or in two instances, changes nothing: each attempt is claimed with a conditional update.
 * ponytail: a timer in the process, like the peer review schedule; move both to a queue or a cron service together.
 */
@Injectable()
export class QuizAttemptsSchedule
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(QuizAttemptsSchedule.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly settler: QuizAttemptSettler,
    private readonly config: ConfigService,
  ) {}

  /** QUIZ_SETTLE_TICK_MS is how often it runs; not set (or 0) means it does not run by itself. */
  onApplicationBootstrap(): void {
    const everyMs = Number(this.config.get<string>('QUIZ_SETTLE_TICK_MS'));
    if (!(everyMs > 0)) return;
    this.timer = setInterval(() => void this.runOnce(), everyMs);
    this.timer.unref();
    this.logger.log(`Quiz settle job runs every ${everyMs} ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Returns how many attempts it submitted. A run that is still going makes the next tick skip. */
  async runOnce(now: Date = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const settled = await this.settler.settleExpired(now);
      if (settled > 0) {
        this.logger.log(`Quiz settle job submitted ${settled} attempt(s)`);
      }
      return settled;
    } catch (error) {
      this.logger.error(`Quiz settle job failed: ${String(error)}`);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
