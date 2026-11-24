import { fork } from 'node:child_process';
import { join } from 'node:path';
import {
  deadline,
  CHILD_APP_START_TIMEOUT_MS,
  CHILD_APP_STOP_TIMEOUT_MS,
  CHILD_APP_KILL_TIMEOUT_MS,
} from './deadlines';
import type { AssessmentActivity } from '../../src/infrastructure/clients/assessment/assessment.client';
import type { AppMessage, AppCommand } from './app-process-messages';

export interface TestAppProcess {
  url: string;
  startupMs: number;
  relay: { enabled: boolean; topic: string };
  brokerWarning: string | undefined;
  close: () => Promise<void>;
}

/** The child receives its environment before ts-node or AppModule is loaded. */
export async function startTestApp(
  environment: Record<string, string>,
  assessmentActivity?: () => Promise<AssessmentActivity>,
): Promise<TestAppProcess> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Refusing integration app child in production');
  const child = fork(join(__dirname, 'app-process-child.ts'), [], {
    // Static typechecking covers this fixture; avoid repeating it in each app child.
    execArgv: ['--require', 'ts-node/register/transpile-only'],
    env: {
      ...process.env,
      ...environment,
      LEARNING_IT_APP_SCENARIO: assessmentActivity ? 'withdrawal' : 'relay',
    },
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    windowsHide: true,
  });
  const exited = new Promise<void>((resolve) =>
    child.once('exit', () => resolve()),
  );
  const killOnExit = () => {
    child.kill('SIGKILL');
  };
  process.once('exit', killOnExit);
  let childFailure: string | undefined;
  async function close(): Promise<void> {
    try {
      if (child.exitCode !== null || child.signalCode !== null) {
        if (childFailure) throw new Error(childFailure);
        return;
      }
      if (child.connected) child.send({ type: 'stop' } satisfies AppCommand);
      await deadline(exited, 'test app child exit', CHILD_APP_STOP_TIMEOUT_MS);
      if (childFailure) throw new Error(childFailure);
      if (child.exitCode !== 0)
        throw new Error(`Test app child exit code ${String(child.exitCode)}`);
    } catch (error) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
        await deadline(
          exited,
          'test app child forced exit',
          CHILD_APP_KILL_TIMEOUT_MS,
        );
      }
      throw error;
    } finally {
      process.removeListener('exit', killOnExit);
    }
  }
  const app: TestAppProcess = {
    url: '',
    startupMs: 0,
    relay: { enabled: false, topic: '' },
    brokerWarning: undefined,
    close,
  };
  async function answerAssessment(requestId: number): Promise<void> {
    let command: AppCommand;
    try {
      if (!assessmentActivity)
        throw new Error('No assessment fixture callback');
      command = {
        type: 'assessment-result',
        requestId,
        activity: await assessmentActivity(),
      };
    } catch {
      command = {
        type: 'assessment-result',
        requestId,
        error: 'assessment timeout',
      };
    }
    if (child.connected) child.send(command);
  }
  const ready = new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) =>
      reject(new Error(`Test app exited before startup (code ${code})`)),
    );
    child.on('message', (value: AppMessage) => {
      if (value.type === 'ready') {
        app.url = value.url;
        app.startupMs = value.startupMs;
        app.relay = value.relay;
        resolve();
      } else if (value.type === 'broker-warning') {
        app.brokerWarning = value.message;
      } else if (value.type === 'error') {
        childFailure = value.message;
        reject(new Error(value.message));
      } else {
        void answerAssessment(value.requestId);
      }
    });
  });
  try {
    await deadline(
      ready,
      'test app startup/configuration',
      CHILD_APP_START_TIMEOUT_MS,
    );
    return app;
  } catch (error) {
    try {
      await close();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Test app startup and cleanup failed',
      );
    }
    throw error;
  }
}
