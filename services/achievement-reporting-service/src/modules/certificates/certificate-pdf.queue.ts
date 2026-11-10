import { HttpException, Inject, Injectable } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import {
  CERTIFICATE_READ_CONFIG,
  type CertificateReadConfig,
  unavailable,
} from './certificate-read.config';
interface Waiter {
  start: () => void;
  timer: ReturnType<typeof setTimeout>;
}
@Injectable()
export class CertificatePdfQueue {
  private active = false;
  private readonly waiting: Waiter[] = [];
  constructor(
    @Inject(CERTIFICATE_READ_CONFIG)
    private readonly config: CertificateReadConfig,
  ) {}
  async run<T>(render: (waitMs: number) => Promise<T>): Promise<T> {
    const arrived = performance.now();
    if (this.active) {
      if (this.waiting.length >= this.config.queueSize) unavailable();
      await new Promise<void>((resolve, reject) => {
        const waiter: Waiter = {
          start: resolve,
          timer: setTimeout(() => {
            const index = this.waiting.indexOf(waiter);
            if (index >= 0) this.waiting.splice(index, 1);
            reject(new HttpException({ code: 'SERVICE_UNAVAILABLE' }, 503));
          }, this.config.queueWaitMs),
        };
        this.waiting.push(waiter);
      });
    } else this.active = true;
    try {
      const waitMs = performance.now() - arrived;
      if (waitMs >= this.config.queueWaitMs) unavailable();
      return await render(waitMs);
    } finally {
      const next = this.waiting.shift();
      if (next) {
        clearTimeout(next.timer);
        next.start();
      } else this.active = false;
    }
  }
}
