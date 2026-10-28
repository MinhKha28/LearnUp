import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HEADER_NAMES } from '@learnup/ts-common';
import { INotificationItem, NotificationClient } from './notification.client';

const DEFAULT_TIMEOUT_MS = 5000;

export class HttpNotificationClient extends NotificationClient {
  private readonly baseUrl: string;
  private readonly internalKey: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    super();
    this.baseUrl =
      config.get<string>('NOTIFICATION_SERVICE_URL') ?? 'http://localhost:8082';
    this.internalKey = config.getOrThrow<string>('INTERNAL_SERVICE_KEY');
    this.timeoutMs =
      Number(config.get<string>('NOTIFICATION_SERVICE_TIMEOUT_MS')) ||
      DEFAULT_TIMEOUT_MS;
  }

  /** POST /api/v1/notifications/send is for services only: it has no x-user-id header (a call with a user gets 403). */
  async send(item: INotificationItem): Promise<void> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/v1/notifications/send`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [HEADER_NAMES.INTERNAL_KEY]: this.internalKey,
        },
        body: JSON.stringify({
          organizationId: item.organizationId,
          recipientUserId: item.recipientUserId,
          title: item.title,
          message: item.message,
          type: 'PEER_REVIEW',
          channel: 'IN_APP',
          metadata: item.metadata ? JSON.stringify(item.metadata) : undefined,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'NOTIFICATION_SERVICE_UNAVAILABLE',
        message: 'Unable to reach the notification service.',
      });
    }
    if (!response.ok) {
      throw new ServiceUnavailableException({
        code: 'NOTIFICATION_SERVICE_UNAVAILABLE',
        message: `The notification service answered ${response.status}.`,
      });
    }
  }
}
