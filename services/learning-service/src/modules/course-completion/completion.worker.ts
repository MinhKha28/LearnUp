import {
  Injectable,
  Logger,
  OnModuleInit,
  BeforeApplicationShutdown,
  Inject,
} from '@nestjs/common';
import { COMPLETION_CONFIG, type CompletionConfig } from './completion.config';
import { CompletionRepository } from './completion.repository';
import { CompletionService } from './completion.service';
@Injectable()
export class CompletionWorker
  implements OnModuleInit, BeforeApplicationShutdown
{
  private readonly logger = new Logger(CompletionWorker.name);
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private stopped = false;
  constructor(
    private readonly repository: CompletionRepository,
    private readonly service: CompletionService,
    @Inject(COMPLETION_CONFIG) private readonly config: CompletionConfig,
  ) {}
  onModuleInit() {
    if (this.config.enabled) this.schedule(0);
  }
  private schedule(delay: number) {
    this.timer = setTimeout(() => {
      void this.tick().finally(() => {
        if (!this.stopped) this.schedule(this.config.pollMs);
      });
    }, delay);
  }
  tick(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) return this.running;
    this.running = this.run()
      .catch(() => this.logger.error('COMPLETION_WORKER_FAILURE'))
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }
  private async run() {
    const limit = Math.min(this.config.batchSize, this.config.concurrency);
    do {
      const requests = await this.repository.claim(limit);
      await Promise.all(requests.map((r) => this.service.evaluate(r)));
      if (this.stopped || requests.length < limit) break;
      // Yield between full waves; never lease work before an evaluation slot exists.
      await new Promise<void>((resolve) => setImmediate(resolve));
    } while (!this.stopped);
    const metrics = await this.repository.metrics();
    this.logger.log(
      JSON.stringify({
        metric: 'completion_queue',
        ...metrics,
        ...this.service.metrics,
      }),
    );
  }
  async beforeApplicationShutdown() {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.running;
  }
}
