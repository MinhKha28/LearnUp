import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import {
  RELAY_CONFIG,
  type RelayConfig,
} from '../../src/modules/outbox/relay.config';
import {
  ASSESSMENT_CLIENT,
  type AssessmentClient,
  type AssessmentActivity,
} from '../../src/infrastructure/clients/assessment/assessment.client';
import {
  TENANT_CLIENT,
  type TenantClient,
} from '../../src/infrastructure/clients/tenant/tenant.client';
import {
  closeApp,
  deadline,
  BARRIER_TIMEOUT_MS,
  CHILD_APP_STOP_TIMEOUT_MS,
} from './deadlines';
import type { AppMessage, AppCommand } from './app-process-messages';

let app: NestExpressApplication | undefined;
let stopping = false;
let nextRequestId = 0;
const pending = new Map<
  number,
  {
    resolve: (value: AssessmentActivity) => void;
    reject: (error: Error) => void;
  }
>();
const send = (message: AppMessage) => {
  if (process.connected) process.send!(message);
};

async function stop(code = 0): Promise<void> {
  if (stopping) return;
  stopping = true;
  // A lost test parent must not leave a native Kafka process behind.
  const forceExit = setTimeout(
    () => process.exit(1),
    CHILD_APP_STOP_TIMEOUT_MS,
  );
  try {
    for (const request of pending.values())
      request.reject(new Error('Test app stopped'));
    await closeApp(app);
  } catch (error) {
    code = 1;
    send({
      type: 'error',
      message:
        error instanceof Error ? error.message : 'Test app cleanup failed',
    });
  } finally {
    clearTimeout(forceExit);
    process.exit(code);
  }
}
process.on('disconnect', () => {
  void stop();
});
process.on('message', (command: AppCommand) => {
  if (command.type === 'stop') {
    void stop();
    return;
  }
  const request = pending.get(command.requestId);
  if (command.activity) request?.resolve(command.activity);
  else
    request?.reject(new Error(command.error ?? 'Missing assessment fixture'));
});

async function activity(): Promise<AssessmentActivity> {
  const requestId = ++nextRequestId;
  try {
    return await deadline(
      new Promise<AssessmentActivity>((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
        send({ type: 'assessment-activity', requestId });
      }),
      'assessment fixture reply',
      BARRIER_TIMEOUT_MS,
    );
  } finally {
    pending.delete(requestId);
  }
}

async function main(): Promise<void> {
  const start = performance.now();
  Logger.prototype.warn = (message: unknown) => {
    if (
      typeof message === 'string' &&
      message.startsWith('OUTBOX_BROKER_UNAVAILABLE:')
    )
      send({ type: 'broker-warning', message });
  };
  app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
    abortOnError: false,
  });
  const relay = app.get<RelayConfig>(RELAY_CONFIG);
  if (process.env.LEARNING_IT_APP_SCENARIO === 'relay') {
    assert.equal(
      relay.enabled,
      true,
      'OUTBOX_RELAY_ENABLED must be true before AppModule import',
    );
    assert.equal(
      relay.topic,
      process.env.OUTBOX_TOPIC,
      'OUTBOX_TOPIC must match the test topic before AppModule import',
    );
  } else {
    assert.equal(
      app.get(ConfigService).get('ENROLLMENT_RATE_LIMIT_PER_MINUTE'),
      '1000',
      'ENROLLMENT_RATE_LIMIT_PER_MINUTE must be set before AppModule import',
    );
    app.get<AssessmentClient>(ASSESSMENT_CLIENT).getActivity = activity;
    app.get<TenantClient>(TENANT_CLIENT).lookupLearners = (_user, ids) =>
      Promise.resolve(
        ids.map((userId) => ({
          userId,
          role: 'Learner',
          status: 'Active',
          deletedAt: null,
          activatedAt: null,
          fullName: 'Fixture',
          email: 'fixture@example.test',
        })),
      );
  }
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  send({
    type: 'ready',
    startupMs: performance.now() - start,
    url: `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`,
    relay: { enabled: relay.enabled, topic: relay.topic },
  });
}
void main().catch(async (error: unknown) => {
  send({
    type: 'error',
    message: error instanceof Error ? error.message : 'Test app startup failed',
  });
  await stop(1);
});
