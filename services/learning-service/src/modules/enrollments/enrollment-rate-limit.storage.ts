import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';

@Injectable()
export class EnrollmentRateLimitStorage
  implements ThrottlerStorage, OnApplicationShutdown
{
  private readonly windows = new Map<
    string,
    { hits: number; expiresAt: number }
  >();
  private readonly sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, window] of this.windows) {
      if (window.expiresAt <= now) this.windows.delete(key);
    }
  }, 60_000).unref();

  /** Cửa sổ bắt đầu từ request đầu tiên; request bị chặn không kéo dài cửa sổ. */
  increment(key: string, ttl: number, limit: number) {
    const now = Date.now();
    let window = this.windows.get(key);
    if (!window || window.expiresAt <= now) {
      window = { hits: 0, expiresAt: now + ttl };
      this.windows.set(key, window);
    }
    window.hits += 1;
    const seconds = Math.ceil((window.expiresAt - now) / 1000);
    return Promise.resolve({
      totalHits: window.hits,
      timeToExpire: seconds,
      isBlocked: window.hits > limit,
      timeToBlockExpire: window.hits > limit ? seconds : 0,
    });
  }

  onApplicationShutdown(): void {
    clearInterval(this.sweep);
    this.windows.clear();
  }
}
